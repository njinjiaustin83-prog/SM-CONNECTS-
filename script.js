/* =========================================================
   SM CONNECTS - Main JavaScript
   Frontend demo/application logic
   ========================================================= */

"use strict";

const SM = {
  storage: {
    users: "sm_connects_users",
    currentUser: "sm_connects_current_user",
    profiles: "sm_connects_profiles",
    likes: "sm_connects_likes",
    messages: "sm_connects_messages"
  },

  init() {
    this.seedDemoProfiles();
    this.bindForms();
    this.bindButtons();
    this.updateUI();
    this.loadPageData();
  },

  /* ---------------------------------------------------------
     Storage helpers
     --------------------------------------------------------- */

  get(key, fallback = []) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      console.error("Storage error:", error);
      return fallback;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  currentUser() {
    return this.get(SM.storage.currentUser, null);
  },

  /* ---------------------------------------------------------
     Demo profiles
     --------------------------------------------------------- */

  seedDemoProfiles() {
    const profiles = this.get(SM.storage.profiles, null);

    if (profiles && profiles.length) return;

    const demoProfiles = [
      {
        id: "profile-1",
        name: "Sophia",
        age: 28,
        gender: "Woman",
        country: "Australia",
        city: "Brisbane",
        bio: "Friendly, adventurous and looking for someone genuine.",
        interests: ["Travel", "Music", "Food", "Beach"],
        photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600"
      },
      {
        id: "profile-2",
        name: "Emma",
        age: 31,
        gender: "Woman",
        country: "United Kingdom",
        city: "London",
        bio: "I enjoy good conversation, travelling and discovering new places.",
        interests: ["Travel", "Movies", "Fitness"],
        photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600"
      },
      {
        id: "profile-3",
        name: "Olivia",
        age: 27,
        gender: "Woman",
        country: "Canada",
        city: "Toronto",
        bio: "Positive energy, great friends and hoping to meet someone special.",
        interests: ["Photography", "Music", "Coffee"],
        photo: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600"
      },
      {
        id: "profile-4",
        name: "Daniel",
        age: 30,
        gender: "Man",
        country: "Australia",
        city: "Sydney",
        bio: "Easygoing and passionate about travel, sport and technology.",
        interests: ["Sport", "Travel", "Technology"],
        photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600"
      },
      {
        id: "profile-5",
        name: "James",
        age: 34,
        gender: "Man",
        country: "United States",
        city: "New York",
        bio: "Looking for meaningful conversations and a genuine connection.",
        interests: ["Fitness", "Travel", "Business"],
        photo: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600"
      }
    ];

    this.set(SM.storage.profiles, demoProfiles);
  },

  /* ---------------------------------------------------------
     Authentication
     --------------------------------------------------------- */

  signup(formData) {
    const users = this.get(SM.storage.users);

    const email = String(formData.email || "").trim().toLowerCase();
    const password = String(formData.password || "");

    if (!email || !password) {
      this.notify("Please enter your email and password.", "error");
      return false;
    }

    if (password.length < 8) {
      this.notify("Password must contain at least 8 characters.", "error");
      return false;
    }

    if (users.some(user => user.email === email)) {
      this.notify("An account with this email already exists.", "error");
      return false;
    }

    const user = {
      id: "user-" + Date.now(),
      name: formData.name || "SM CONNECTS Member",
      email,
      password,
      country: formData.country || "",
      city: formData.city || "",
      gender: formData.gender || "",
      age: Number(formData.age) || null,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    this.set(SM.storage.users, users);

    this.login(email, password);

    this.notify("Account created successfully!", "success");
    return true;
  },

  login(email, password) {
    const users = this.get(SM.storage.users);

    const user = users.find(
      item =>
        item.email === String(email).trim().toLowerCase() &&
        item.password === password
    );

    if (!user) {
      this.notify("Incorrect email or password.", "error");
      return false;
    }

    const safeUser = { ...user };
    delete safeUser.password;

    this.set(SM.storage.currentUser, safeUser);

    this.updateUI();
    this.notify("Welcome back, " + safeUser.name + "!", "success");

    return true;
  },

  logout() {
    localStorage.removeItem(SM.storage.currentUser);
    this.updateUI();
    this.notify("You have been logged out.", "success");

    setTimeout(() => {
      if (location.pathname.includes("profile")) {
        location.href = "index.html";
      }
    }, 700);
  },

  /* ---------------------------------------------------------
     Profiles
     --------------------------------------------------------- */

  createProfile(data) {
    const user = this.currentUser();

    if (!user) {
      this.notify("Please log in first.", "error");
      return false;
    }

    const profiles = this.get(SM.storage.profiles);

    const existing = profiles.find(profile => profile.userId === user.id);

    const profile = {
      id: existing ? existing.id : "profile-" + Date.now(),
      userId: user.id,
      name: data.name || user.name,
      age: Number(data.age) || user.age,
      gender: data.gender || user.gender,
      country: data.country || user.country,
      city: data.city || user.city,
      bio: data.bio || "",
      interests: this.parseInterests(data.interests),
      photo: data.photo || ""
    };

    const filtered = profiles.filter(item => item.userId !== user.id);
    filtered.push(profile);

    this.set(SM.storage.profiles, filtered);

    this.notify("Profile saved successfully!", "success");
    this.renderProfiles();

    return true;
  },

  parseInterests(interests) {
    if (Array.isArray(interests)) return interests;

    return String(interests || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
  },

  getProfiles() {
    return this.get(SM.storage.profiles);
  },

  /* ---------------------------------------------------------
     Matching
     --------------------------------------------------------- */

  getMatches() {
    const user = this.currentUser();

    if (!user) return [];

    const profiles = this.getProfiles();

    return profiles.filter(profile => profile.userId !== user.id);
  },

  calculateMatch(profile) {
    const user = this.currentUser();

    if (!user) return 0;

    let score = 50;

    if (
      user.country &&
      profile.country &&
      user.country.toLowerCase() === profile.country.toLowerCase()
    ) {
      score += 20;
    }

    if (
      user.city &&
      profile.city &&
      user.city.toLowerCase() === profile.city.toLowerCase()
    ) {
      score += 15;
    }

    const userProfile = this.getProfiles().find(
      item => item.userId === user.id
    );

    if (userProfile && userProfile.interests && profile.interests) {
      const common = userProfile.interests.filter(interest =>
        profile.interests.some(
          item => item.toLowerCase() === interest.toLowerCase()
        )
      );

      score += Math.min(common.length * 5, 15);
    }

    return Math.min(score, 100);
  },

  /* ---------------------------------------------------------
     Likes
     --------------------------------------------------------- */

  likeProfile(profileId) {
    const user = this.currentUser();

    if (!user) {
      this.notify("Please log in to like profiles.", "error");
      return;
    }

    const likes = this.get(SM.storage.likes);

    const exists = likes.some(
      like => like.userId === user.id && like.profileId === profileId
    );

    if (exists) {
      this.notify("You already liked this profile.", "error");
      return;
    }

    likes.push({
      id: "like-" + Date.now(),
      userId: user.id,
      profileId,
      createdAt: new Date().toISOString()
    });

    this.set(SM.storage.likes, likes);

    this.notify("Profile liked!", "success");

    this.renderProfiles();
  },

  isLiked(profileId) {
    const user = this.currentUser();

    if (!user) return false;

    const likes = this.get(SM.storage.likes);

    return likes.some(
      like => like.userId === user.id && like.profileId === profileId
    );
  },

  /* ---------------------------------------------------------
     Messaging
     --------------------------------------------------------- */

  sendMessage(profileId, message) {
    const user = this.currentUser();

    if (!user) {
      this.notify("Please log in to send messages.", "error");
      return false;
    }

    const text = String(message || "").trim();

    if (!text) {
      this.notify("Please enter a message.", "error");
      return false;
    }

    const messages = this.get(SM.storage.messages);

    messages.push({
      id: "message-" + Date.now(),
      senderId: user.id,
      receiverId: profileId,
      message: text,
      createdAt: new Date().toISOString()
    });

    this.set(SM.storage.messages, messages);

    this.notify("Message sent.", "success");

    return true;
  },

  getConversation(profileId) {
    const user = this.currentUser();

    if (!user) return [];

    const messages = this.get(SM.storage.messages);

    return messages.filter(
      message =>
        (message.senderId === user.id &&
          message.receiverId === profileId) ||
        (message.senderId === profileId &&
          message.receiverId === user.id)
    );
  },

  /* ---------------------------------------------------------
     Rendering
     --------------------------------------------------------- */

  renderProfiles(containerId = "profiles-container") {
    const container = document.getElementById(containerId);

    if (!container) return;

    const profiles = this.getMatches();

    if (!profiles.length) {
      container.innerHTML =
        '<p class="no-results">No profiles available yet.</p>';
      return;
    }

    container.innerHTML = profiles
      .map(profile => {
        const liked = this.isLiked(profile.id);
        const match = this.calculateMatch(profile);

        return `
          <article class="profile-card" data-profile-id="${this.escape(
            profile.id
          )}">
            <img
              src="${this.escape(profile.photo || "images/default-profile.jpg")}"
              alt="${this.escape(profile.name)}"
              class="profile-image"
              onerror="this.src='images/default-profile.jpg'"
            >

            <div class="profile-card-content">
              <h3>
                ${this.escape(profile.name)}
                ${profile.age ? `, ${this.escape(profile.age)}` : ""}
              </h3>

              <p class="profile-location">
                ${this.escape(profile.city || "")}
                ${profile.city && profile.country ? ", " : ""}
                ${this.escape(profile.country || "")}
              </p>

              <p>${this.escape(profile.bio || "")}</p>

              <div class="match-score">
                ${match}% Match
              </div>

              <div class="interests">
                ${(profile.interests || [])
                  .map(
                    interest =>
                      `<span class="interest">${this.escape(interest)}</span>`
                  )
                  .join("")}
              </div>

              <div class="profile-actions">
                <button
                  type="button"
                  class="like-btn"
                  data-profile-id="${this.escape(profile.id)}"
                >
                  ${liked ? "♥ Liked" : "♡ Like"}
                </button>

                <button
                  type="button"
                  class="message-btn"
                  data-profile-id="${this.escape(profile.id)}"
                >
                  Message
                </button>
              </div>
            </div>
          </article>
        `;
      })
      .join("");

    this.bindProfileButtons();
  },

  renderCurrentUserProfile(containerId = "my-profile") {
    const container = document.getElementById(containerId);

    if (!container) return;

    const user = this.currentUser();

    if (!user) {
      container.innerHTML = `
        <p>Please log in to view your profile.</p>
      `;
      return;
    }

    const profile = this.getProfiles().find(
      item => item.userId === user.id
    );

    if (!profile) {
      container.innerHTML = `
        <p>Your profile has not been created yet.</p>
      `;
      return;
    }

    container.innerHTML = `
      <div class="my-profile-card">
        <img
          src="${this.escape(
            profile.photo || "images/default-profile.jpg"
          )}"
          alt="${this.escape(profile.name)}"
          class="profile-image"
        >

        <h2>${this.escape(profile.name)}</h2>

        <p>
          ${this.escape(profile.city || "")}
          ${profile.city && profile.country ? ", " : ""}
          ${this.escape(profile.country || "")}
        </p>

        <p>${this.escape(profile.bio || "")}</p>

        <div class="interests">
          ${(profile.interests || [])
            .map(
              interest =>
                `<span class="interest">${this.escape(interest)}</span>`
            )
            .join("")}
        </div>
      </div>
    `;
  },

  /* ---------------------------------------------------------
     Search
     --------------------------------------------------------- */

  searchProfiles(searchTerm) {
    const term = String(searchTerm || "").trim().toLowerCase();

    const profiles = this.getMatches();

    if (!term) {
      this.renderProfiles();
      return;
    }

    const results = profiles.filter(profile => {
      const content = [
        profile.name,
        profile.country,
        profile.city,
        profile.gender,
        profile.bio,
        ...(profile.interests || [])
      ]
        .join(" ")
        .toLowerCase();

      return content.includes(term);
    });

    this.renderProfileResults(results);
  },

  renderProfileResults(profiles, containerId = "profiles-container") {
    const container = document.getElementById(containerId);

    if (!container) return;

    if (!profiles.length) {
      container.innerHTML = `
        <p class="no-results">No matching profiles found.</p>
      `;
      return;
    }

    container.innerHTML = profiles
      .map(profile => {
        const match = this.calculateMatch(profile);

        return `
          <article class="profile-card">
            <img
              src="${this.escape(
                profile.photo || "images/default-profile.jpg"
              )}"
              alt="${this.escape(profile.name)}"
              class="profile-image"
              onerror="this.src='images/default-profile.jpg'"
            >

            <div class="profile-card-content">
              <h3>
                ${this.escape(profile.name)}
                ${profile.age ? `, ${this.escape(profile.age)}` : ""}
              </h3>

              <p>
                ${this.escape(profile.city || "")}
                ${profile.city && profile.country ? ", " : ""}
                ${this.escape(profile.country || "")}
              </p>

              <p>${this.escape(profile.bio || "")}</p>

              <strong>${match}% Match</strong>

              <button
                type="button"
                class="like-btn"
                data-profile-id="${this.escape(profile.id)}"
              >
                ${this.isLiked(profile.id) ? "♥ Liked" : "♡ Like"}
              </button>
            </div>
          </article>
        `;
      })
      .join("");

    this.bindProfileButtons();
  },

  /* ---------------------------------------------------------
     UI
     --------------------------------------------------------- */

  updateUI() {
    const user = this.currentUser();

    document.querySelectorAll("[data-auth='logged-in']").forEach(element => {
      element.style.display = user ? "" : "none";
    });

    document
      .querySelectorAll("[data-auth='logged-out']")
      .forEach(element => {
        element.style.display = user ? "none" : "";
      });

    document.querySelectorAll("[data-user-name]").forEach(element => {
      element.textContent = user ? user.name : "Guest";
    });

    document.querySelectorAll("[data-user-email]").forEach(element => {
      element.textContent = user ? user.email : "";
    });
  },

  /* ---------------------------------------------------------
     Event binding
     --------------------------------------------------------- */

  bindForms() {
    const loginForm = document.querySelector("#login-form");

    if (loginForm) {
      loginForm.addEventListener("submit", event => {
        event.preventDefault();

        const form = new FormData(loginForm);

        this.login(
          form.get("email"),
          form.get("password")
        );
      });
    }

    const signupForm = document.querySelector("#signup-form");

    if (signupForm) {
      signupForm.addEventListener("submit", event => {
        event.preventDefault();

        const form = new FormData(signupForm);

        this.signup({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          age: form.get("age"),
          gender: form.get("gender"),
          country: form.get("country"),
          city: form.get("city")
        });
      });
    }

    const profileForm = document.querySelector("#profile-form");

    if (profileForm) {
      profileForm.addEventListener("submit", event => {
        event.preventDefault();

        const form = new FormData(profileForm);

        this.createProfile({
          name: form.get("name"),
          age: form.get("age"),
          gender: form.get("gender"),
          country: form.get("country"),
          city: form.get("city"),
          bio: form.get("bio"),
          interests: form.get("interests"),
          photo: form.get("photo")
        });
      });
    }

    const searchForm = document.querySelector("#search-form");

    if (searchForm) {
      searchForm.addEventListener("submit", event => {
        event.preventDefault();

        const input = searchForm.querySelector(
          "input[name='search'], input[type='search']"
        );

        if (input) {
          this.searchProfiles(input.value);
        }
      });
    }
  },

  bindButtons() {
    document.addEventListener("click", event => {
      const logoutButton = event.target.closest("[data-action='logout']");

      if (logoutButton) {
        event.preventDefault();
        this.logout();
      }

      const likeButton = event.target.closest(".like-btn");

      if (likeButton) {
        event.preventDefault();

        const profileId = likeButton.dataset.profileId;

        if (profileId) {
          this.likeProfile(profileId);
        }
      }

      const messageButton = event.target.closest(".message-btn");

      if (messageButton) {
        event.preventDefault();

        const profileId = messageButton.dataset.profileId;

        if (pr