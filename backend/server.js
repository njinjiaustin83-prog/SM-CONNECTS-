const crypto = require("crypto")
const {
  getUserByEmail,
  getUserById,
  createUser,
  setEmailVerified,
  saveProfile,
  getProfile,
  likeUser,
  createMessage,
  getMessages
} = require("./database");
;"use strict";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET environment variable.");
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));

/*
 * DEMO STORAGE
 *
 * This is intentionally in-memory while we build the API.
 * Data will disappear when the server restarts.
 *
 * Production version should use a real database.
 */

const users = new Map();
const verificationTokens = new Map();
const resetTokens = new Map();

let nextUserId = 1;

/*
 * SMTP
 *
 * SMTP credentials must come from environment variables.
 * Never put the real password directly in this file.
 */

let mailer = null;

if (
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASSWORD
) {
  mailer = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
}

/*
 * HEALTH CHECK
 */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "SM CONNECTS API"
  });
});

/*
 * CREATE ACCOUNT
 */

app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      country
    } = req.body;

    if (!name || !email || !password || !country) {
      return res.status(400).json({
        error: "Name, email, password and country are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        error: "Password must contain at least 8 characters."
      });
    }

    const normalizedEmail =
      String(email).trim().toLowerCase();

    if (users.has(normalizedEmail)) {
      return res.status(409).json({
        error: "An account with this email already exists."
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const user = {
      id: String(nextUserId++),
      name: String(name).trim(),
      email: normalizedEmail,
      country: String(country),
      passwordHash,
      emailVerified: false,
      profile: null,
      createdAt: new Date().toISOString()
    };

    users.set(normalizedEmail, user);

    /*
     * Generate a verification token.
     */

    const token =
      crypto.randomBytes(32).toString("hex");

    verificationTokens.set(token, {
      email: normalizedEmail,
      expiresAt: Date.now() + 1000 * 60 * 30
    });

    await sendVerificationEmail(
      normalizedEmail,
      token
    );

    res.status(201).json({
      message:
        "Account created. Please check your email to verify your account."
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Unable to create account."
    });
  }
});

/*
 * VERIFY EMAIL
 */

app.get("/api/auth/verify", (req, res) => {

  const token =
    String(req.query.token || "");

  const record =
    verificationTokens.get(token);

  if (!record) {
    return res.status(400).json({
      error: "Invalid verification link."
    });
  }

  if (Date.now() > record.expiresAt) {

    verificationTokens.delete(token);

    return res.status(400).json({
      error: "Verification link has expired."
    });
  }

  const user =
    users.get(record.email);

  if (!user) {
    return res.status(404).json({
      error: "Account not found."
    });
  }

  user.emailVerified = true;

  verificationTokens.delete(token);

  res.json({
    message: "Email verified successfully."
  });
});

/*
 * LOGIN
 */

app.post("/api/auth/login", async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    const normalizedEmail =
      String(email || "")
        .trim()
        .toLowerCase();

    const user =
      users.get(normalizedEmail);

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    const valid =
      await bcrypt.compare(
        password || "",
        user.passwordHash
      );

    if (!valid) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        error:
          "Please verify your email before logging in."
      });
    }

    const accessToken =
      jwt.sign(
        {
          sub: user.id,
          email: user.email
        },
        JWT_SECRET,
        {
          expiresIn: "7d"
        }
      );

    res.json({
      message: "Login successful.",
      accessToken,
      user: publicUser(user)
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Unable to log in."
    });
  }
});

/*
 * AUTHENTICATION MIDDLEWARE
 */

function authenticate(req, res, next) {

  const header =
    req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  const token =
    header.substring(7);

  try {

    const decoded =
      jwt.verify(token, JWT_SECRET);

    req.auth = decoded;

    next();

  } catch {

    return res.status(401).json({
      error: "Invalid or expired session."
    });
  }
}

/*
 * GET CURRENT USER
 */

app.get(
  "/api/me",
  authenticate,
  (req, res) => {

    const user =
      findUserById(req.auth.sub);

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    res.json({
      user: publicUser(user)
    });
  }
);

/*
 * CREATE / UPDATE PROFILE
 */

app.put(
  "/api/profile",
  authenticate,
  (req, res) => {

    const user =
      findUserById(req.auth.sub);

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    const {
      firstName,
      age,
      gender,
      lookingFor,
      country,
      city,
      bio,
      interests
    } = req.body;

    if (!firstName || !age || !gender ||
        !lookingFor || !country || !city || !bio) {

      return res.status(400).json({
        error: "Please complete all required profile fields."
      });
    }

    if (Number(age) < 18) {
      return res.status(400).json({
        error:
          "SM CONNECTS is for adults aged 18 and over."
      });
    }

    user.profile = {
      firstName: String(firstName).trim(),
      age: Number(age),
      gender: String(gender),
      lookingFor: String(lookingFor),
      country: String(country),
      city: String(city).trim(),
      bio: String(bio).trim().slice(0, 500),
      interests: Array.isArray(interests)
        ? interests.slice(0, 20)
        : []
    };

    res.json({
      message: "Profile saved.",
      profile: user.profile
    });
  }
);

/*
 * DISCOVER PROFILES
 */

app.get(
  "/api/discover",
  authenticate,
  (req, res) => {

    const {
      country,
      gender,
      lookingFor
    } = req.query;

    const currentUserId =
      req.auth.sub;

    const results = [];

    for (const user of users.values()) {

      if (user.id === currentUserId) {
        continue;
      }

      if (!user.emailVerified || !user.profile) {
        continue;
      }

      const profile = user.profile;

      if (
        country &&
        profile.country !== country
      ) {
        continue;
      }

      if (
        gender &&
        profile.gender !== gender
      ) {
        continue;
      }

      if (
        lookingFor &&
        profile.lookingFor !== lookingFor
      ) {
        continue;
      }

      results.push({
        id: user.id,
        name: profile.firstName,
        age: profile.age,
        gender: profile.gender,
        country: profile.country,
        city: profile.city,
        bio: profile.bio,
        interests: profile.interests
      });
    }

    res.json({
      profiles: results
    });
  }
);

/*
 * LIKE
 */

app.post(
  "/api/matches/like/:userId",
  authenticate,
  (req, res) => {

    const target =
      findUserById(req.params.userId);

    if (!target) {
      return res.status(404).json({
        error: "Profile not found."
      });
    }

    /*
     * Production version:
     * store the like in the database and
     * create a match when both users like each other.
     */

    res.json({
      liked: true,
      matched: false,
      message: "Like recorded."
    });
  }
);

/*
 * LOGOUT
 *
 * JWT sessions are stateless, so the client should
 * delete its access token. Production can add token
 * revocation if required.
 */

app.post(
  "/api/auth/logout",
  authenticate,
  (req, res) => {

    res.json({
      message: "Logged out."
    });
  }
);

/*
 * SEND EMAIL
 */

async function sendVerificationEmail(
  email,
  token
) {

  if (!mailer) {

    console.log(
      "SMTP is not configured."
    );

    console.log(
      "Verification token:",
      token
    );

    return;
  }

  /*
   * Replace this URL with your deployed SM CONNECTS
   * frontend URL when deployment is configured.
   */

  const verificationUrl =
    `${process.env.APP_URL || "http://localhost:3000"}` +
    `/verify.html?token=${encodeURIComponent(token)}`;

  await mailer.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.SMTP_USER,

    to: email,

    subject:
      "Verify your SM CONNECTS account",

    text:
      `Welcome to SM CONNECTS.\n\n` +
      `Verify your email here:\n${verificationUrl}\n\n` +
      `This link expires in 30 minutes.`,

    html:
      `<h2>Welcome to SM CONNECTS</h2>` +
      `<p>Verify your email address to continue.</p>` +
      `<p><a href="${verificationUrl}">Verify my email</a></p>` +
      `<p>This link expires in 30 minutes.</p>`
  });
}

/*
 * SAFE PUBLIC USER OBJECT
 *
 * Never send passwordHash to the browser.
 */

function publicUser(user) {

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    country: user.country,
    emailVerified: user.emailVerified,
    profile: user.profile,
    createdAt: user.createdAt
  };
}

/*
 * FIND USER
 */

function findUserById(id) {

  for (const user of users.values()) {

    if (user.id === id) {
      return user;
    }
  }

  return null;
}

/*
 * 404 HANDLER
 */

app.use((req, res) => {

  res.status(404).json({
    error: "Endpoint not found."
  });
});

/*
 * ERROR HANDLER
 */

app.use((error, req, res, next) => {

  console.error(error);

  res.status(500).json({
    error: "Internal server error."
  });
});

/*
 * START SERVER
 */

app.listen(PORT, () => {

  console.log(
    `SM CONNECTS API running on port ${PORT}`
  );

});feat: connect API server to database layer