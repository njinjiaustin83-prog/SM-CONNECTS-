// --------------------------------------------------
// CONNECTION REQUESTS
// --------------------------------------------------

const connectionsFile = path.join(
  dataDir,
  "connections.json"
);

if (!fs.existsSync(connectionsFile)) {
  fs.writeFileSync(connectionsFile, "[]", "utf8");
}

function readConnections() {
  try {
    return JSON.parse(
      fs.readFileSync(connectionsFile, "utf8")
    );
  } catch (error) {
    console.error("Could not read connections:", error);
    return [];
  }
}

function saveConnections(connections) {
  fs.writeFileSync(
    connectionsFile,
    JSON.stringify(connections, null, 2),
    "utf8"
  );
}


// --------------------------------------------------
// SEND CONNECTION REQUEST
// --------------------------------------------------

app.post("/api/connections/request", (req, res) => {
  try {
    const {
      senderId,
      receiverId
    } = req.body;

    if (!senderId || !receiverId) {
      return res.status(400).json({
        success: false,
        message: "Sender and receiver are required."
      });
    }

    if (senderId === receiverId) {
      return res.status(400).json({
        success: false,
        message: "You cannot connect with yourself."
      });
    }

    const users = readUsers();

    const sender = users.find(
      user => user.id === senderId
    );

    const receiver = users.find(
      user => user.id === receiverId
    );
// --------------------------------------------------
// LOGIN
// --------------------------------------------------

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = readUsers();

    const user = users.find(
      user => user.email === normalizedEmail
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    res.json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to log in."
    });
  }
});

    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const connections = readConnections();

    const existing = connections.find(
      connection =>
        connection.senderId === senderId &&
        connection.receiverId === receiverId
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Connection request already exists."
      });
    }

    const reverseExisting = connections.find(
      connection =>
        connection.senderId === receiverId &&
        connection.receiverId === senderId
    );

    if (reverseExisting) {
      return res.status(409).json({
        success: false,
        message: "This user has already sent you a connection request."
      });
    }

    const connection = {
      id: crypto.randomUUID(),
      senderId,
      receiverId,
      status: "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    connections.push(connection);

    saveConnections(connections);

    res.status(201).json({
      success: true,
      message: "Connection request sent.",
      connection: {
        id: connection.id,
        status: connection.status
      }
    });

  } catch (error) {
    console.error("Connection request error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to send connection request."
    });
  }
});


// --------------------------------------------------
// GET RECEIVED CONNECTION REQUESTS
// --------------------------------------------------

app.get(
  "/api/connections/received/:userId",
  (req, res) => {

    try {
      const userId = req.params.userId;

      const users = readUsers();
      const connections = readConnections();

      const received = connections.filter(
        connection =>
          connection.receiverId === userId &&
          connection.status === "pending"
      );

      const results = received.map(connection => {

        const sender = users.find(
          user => user.id === connection.senderId
        );

        return {
          id: connection.id,
          sender: sender
            ? {
                id: sender.id,
                name: sender.name,
                profile: sender.profile
              }
            : null,
          createdAt: connection.createdAt
        };

      });

      res.json({
        success: true,
        requests: results
      });

    } catch (error) {

      console.error(
        "Received connections error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Unable to load connection requests."
      });
    }
  }
);


// --------------------------------------------------
// ACCEPT OR REJECT CONNECTION
// --------------------------------------------------

app.put(
  "/api/connections/:connectionId",
  (req, res) => {

    try {

      const { connectionId } = req.params;
      const { action, userId } = req.body;

      if (!["accept", "reject"].includes(action)) {
        return res.status(400).json({
          success: false,
          message: "Action must be accept or reject."
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID is required."
        });
      }

      const connections = readConnections();

      const connectionIndex =
        connections.findIndex(
          connection =>
            connection.id === connectionId
        );

      if (connectionIndex === -1) {
        return res.status(404).json({
          success: false,
          message: "Connection request not found."
        });
      }

      const connection =
        connections[connectionIndex];

      if (connection.receiverId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You cannot modify this request."
        });
      }

      if (connection.status !== "pending") {
        return res.status(409).json({
          success: false,
          message: "This request has already been processed."
        });
      }

      connection.status =
        action === "accept"
          ? "accepted"
          : "rejected";

      connection.updatedAt =
        new Date().toISOString();

      saveConnections(connections);

      res.json({
        success: true,
        message:
          action === "accept"
            ? "Connection accepted."
            : "Connection rejected.",
        status: connection.status
      });

    } catch (error) {

      console.error(
        "Connection update error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Unable to update connection."
      });
    }
  }
);


// --------------------------------------------------
// GET ACCEPTED CONNECTIONS
// --------------------------------------------------

app.get(
  "/api/connections/:userId",
  (req, res) => {

    try {

      const userId = req.params.userId;

      const users = readUsers();
      const connections = readConnections();

      const accepted =
        connections.filter(
          connection =>
            connection.status === "accepted" &&
            (
              connection.senderId === userId ||
              connection.receiverId === userId
            )
        );

      const results = accepted.map(connection => {

        const otherUserId =
          connection.senderId === userId
            ? connection.receiverId
            : connection.senderId;

        const otherUser =
          users.find(
            user => user.id === otherUserId
          );

        if (!otherUser) {
          return null;
        }

        return {
          connectionId: connection.id,
          user: {
            id: otherUser.id,
            name: otherUser.name,
            profile: otherUser.profile
          },
          connectedAt: connection.updatedAt
        };

      }).filter(Boolean);

      res.json({
        success: true,
        connections: results
      });

    } catch (error) {

      console.error(
        "Accepted connections error:",
        error
      );

      res.status(500).json({
        success: false,
        message: "Unable to load connections."
      });
    }
  }
);connection request API
);Add login Api