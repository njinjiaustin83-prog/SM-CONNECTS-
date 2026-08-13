const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// --------------------------------------------------
// Basic configuration
// --------------------------------------------------

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve the website files
app.use(express.static(path.join(__dirname, "public")));

// --------------------------------------------------
// Simple local data storage
// --------------------------------------------------

const dataDir = path.join(__dirname, "data");
const usersFile = path.join(dataDir, "users.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, "[]", "utf8");
}

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(usersFile, "utf8"));
  } catch (error) {
    console.error("Could not read users:", error);
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(
    usersFile,
    JSON.stringify(users, null, 2),
    "utf8"
  );
}

// --------------------------------------------------
// Health check
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "SM CONNECTS server is running",
    timestamp: new Date().toISOString()
  });
});

// --------------------------------------------------
// SIGN UP
// --------------------------------------------------

app.post("/api/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const users = readUsers();

    const existingUser = users.find(
      user => user.email === normalizedEmail
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,

      profile: {
        dateOfBirth: "",
        gender: "",
        interestedIn: "",
        country: "",
        state: "",
        city: "",
        bio: "",
        photo: ""
      },

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Signup error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to create account."
    });
  }
});

// --------------------------------------------------
// CREATE / UPDATE PROFILE
// --------------------------------------------------

app.put("/api/profile/:userId", (req, res) => {
  try {
    const { userId } = req.params;

    const {
      dateOfBirth,
      gender,
      interestedIn,
      country,
      state,
      city,
      bio,
      photo
    } = req.body;

    const users = readUsers();

    const userIndex = users.findIndex(
      user => user.id === userId
    );

    if (userIndex === -1) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    users[userIndex].profile = {
      dateOfBirth: dateOfBirth || "",
      gender: gender || "",
      interestedIn: interestedIn || "",
      country: country || "",
      state: state || "",
      city: city || "",
      bio: bio || "",
      photo: photo || ""
    };

    users[userIndex].updatedAt =
      new Date().toISOString();

    saveUsers(users);

    res.json({
      success: true,
      message: "Profile saved successfully.",
      profile: users[userIndex].profile
    });

  } catch (error) {
    console.error("Profile error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to save profile."
    });
  }
});

// --------------------------------------------------
// GET PROFILE
// --------------------------------------------------

app.get("/api/profile/:userId", (req, res) => {
  try {
    const users = readUsers();

    const user = users.find(
      user => user.id === req.params.userId
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });

  } catch (error) {
    console.error("Get profile error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load profile."
    });
  }
});

// --------------------------------------------------
// BASIC PROFILE SEARCH
// --------------------------------------------------

app.get("/api/discover", (req, res) => {
  try {
    const users = readUsers();

    const {
      country,
      city,
      gender,
      interestedIn
    } = req.query;

    let results = users.map(user => ({
      id: user.id,
      name: user.name,
      profile: user.profile
    }));

    if (country) {
      results = results.filter(
        user =>
          user.profile.country.toLowerCase() ===
          country.toLowerCase()
      );
    }

    if (city) {
      results = results.filter(
        user =>
          user.profile.city.toLowerCase() ===
          city.toLowerCase()
      );
    }

    if (gender) {
      results = results.filter(
        user =>
          user.profile.gender.toLowerCase() ===
          gender.toLowerCase()
      );
    }

    if (interestedIn) {
      results = results.filter(
        user =>
          user.profile.interestedIn.toLowerCase() ===
          interestedIn.toLowerCase()
      );
    }

    res.json({
      success: true,
      count: results.length,
      users: results
    });

  } catch (error) {
    console.error("Discover error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to load profiles."
    });
  }
});

// --------------------------------------------------
// ROOT ROUTE
// --------------------------------------------------

app.get("/", (req, res) => {
  const indexFile = path.join(
    __dirname,
    "public",
    "index.html"
  );

  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  res.send(`
    <h1>SM CONNECTS</h1>
    <p>The server is running successfully.</p>
    <p>API: <a href="/api/health">/api/health</a></p>
  `);
});

// --------------------------------------------------
// 404 HANDLER
// --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log("=================================");
  console.log("       SM CONNECTS SERVER");
  console.log("=================================");
  console.log(`Server running on port ${PORT}`);
});public/