import express, { Express, query, Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";
var passwordHash = require("password-hash");
require("dotenv").config();
import db, { rowCount } from "./db/config";

const app: Express = express();
const server: http.Server = http.createServer(app);
const port: number = Number(process.env.PORT || 3001);
const host = process.env.SERVER_HOST || undefined;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

function empty(data: any) {
  if (Array.isArray(data)) {
    return data.length === 0;
  }
  if (typeof data === "object" && Object.keys(data).length === 0) {
    return true;
  }
  if (data === null || data === undefined) {
    return true;
  }
  return false;
}

import { randomMd5 } from "./md5";

(async () => {
  await db.connect();
})();

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("send-message", async (message: Partial<MessageType>) => {
    console.log(message.channel);
    const date = new Date();
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const createdAt = Date.now();
    try {
      const query = await db.query(
        "INSERT INTO messages (id,text, sender,receiver, channel,d,m,y,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          message.id,
          message.text,
          message.sender,
          message.receiver,
          message.channel,
          d,
          m,
          y,
          createdAt,
        ]
      );
      if (rowCount(query.rowCount) > 0) {
        console.log(`message sent successfully ${message}`);
        if (empty(message.channel) || empty(message.text)) return;
        socket.to(message.channel ?? "").emit(`receive-message`, {
          text: message.text,
          sender: message.sender,
          receiver: message.receiver,
          channel: message.channel,
          id: message.id,
          d: d,
          m: m,
          y: y,
          created_at: createdAt,
        });
      }
    } catch (error) {
      console.log(error);
    }
  });

  socket.on("join_private_channel", (data: channelType) => {
    socket.join(data.channel);
    console.log(`${socket.id} joined ${data.channel}`);
  });
});

app.get("/", (req: Request, res: Response) => {
  res.send("hello world");
});

app.post("/register", async (req: Request, res: Response) => {
  const data = req.body;

  const id = randomMd5();
  const channel = randomMd5();
  let password = data.password;
  let ready = true;
  let errorMessage = "";

  password = passwordHash.generate(data.password);
  if (empty(data.phone)) {
    ready = false;
    errorMessage = "Please enter a phone number";
  }
  if (empty(data.name)) {
    ready = false;
    errorMessage = "Please enter your name";
  }
  if (empty(data.password)) {
    ready = false;
    errorMessage = "Please enter a password";
  }
  if (data.password !== data.confirmPassword) {
    ready = false;
    errorMessage = "Passwords do not match";
  }

  try {
    const query = await db.query(
      "SELECT id FROM users WHERE phone=$1 LIMIT 1",
      [data.phone]
    );

    if (rowCount(query.rowCount) > 0) {
      ready = false;
      errorMessage = "Phone number already exists";
    }

    if (ready) {
      const query = await db.query(
        "INSERT INTO users (id,name, phone, channel, password) VALUES ($1,$2,$3,$4,$5)",
        [id, data.name, data.phone, channel, password]
      );

      if (rowCount(query.rowCount) > 0) {
        console.log(`A row has been inserted with row id ${id}`);
        res.json({
          status: "success",
          data: {
            id: id,
            channel: channel,
            name: data.name,
            phone: data.phone,
          },
        });
      } else {
        res.json({ status: "error", error: "An error occurred" });
      }
    } else {
      res.json({ status: "error", error: errorMessage });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    res.json({ status: "error", error: "Internal server error" });
  }
});

app.get("/chat", (req: Request, res: Response) => {
  res.sendFile("file.html", { root: __dirname });
});
interface UserRow {
  id: number;
  name: string;
  phone: string;
  password: string; // Assuming password is a string
  // Add more properties as needed
}

// Function to fetch user by phone number

app.post("/login", async (req: Request, res: Response) => {
  const data = req.body;
  let ready = true;
  let errorMessage = "";

  if (empty(data.phone)) {
    ready = false;
    errorMessage = "Please enter a phone number";
  }
  if (empty(data.password)) {
    ready = false;
    errorMessage = "Please enter your Password";
  }

  if (ready) {
    try {
      const query = await db.query(
        "SELECT * FROM users WHERE phone=$1 LIMIT 1",
        [data.phone]
      );
      if (query.rowCount) {
        const row = query.rows[0];

        try {
          const passwordMatch = passwordHash.verify(
            data.password,
            row.password
          );
          if (passwordMatch) {
            delete row.password;
            res.json({ status: "success", data: row });
          } else {
            res.json({ status: "error", error: "Incorrect password" });
          }
        } catch (e) {
          console.log(e);
          res.json({ status: "error", error: "An error occurred" });
        }
      } else {
        res.json({ status: "error", error: "User not found" });
      }
    } catch (err: any) {
      console.log(err.message);
      res.json({ status: "error", error: "An error occurred" });
    }
  } else {
    res.json({ status: "error", error: errorMessage });
  }
});

app.post("/users", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const query = await db.query(
      "SELECT name,id,channel FROM users WHERE id <> $1",
      [data.user]
    );
    if (query.rowCount) {
      res.json({ status: "success", data: query.rows });
    } else {
      res.json({ status: "error", error: "An error occurred" });
    }
  } catch (err: any) {
    console.log(err.message);
    res.json({ status: "error", error: "Internal server error" });
  }
});

app.post("/all-messages", async (req: Request, res: Response) => {
  try {
    const data = req.body;
    const userId = data.user;
    let added = new Set();
    const query = await db.query(
      "SELECT sender, receiver, text, created_at FROM messages WHERE (sender=$1) OR (receiver=$1)  ORDER BY created_at DESC LIMIT 10",
      [userId]
    );
    let messages: any[] = [];

    if (rowCount(query.rowCount) > 0) {
      for (let msg of query.rows) {
        if (!added.has(msg.sender) && !added.has(msg.receiver)) {
          if (msg.sender != userId) added.add(msg.sender);
          if (msg.receiver != userId) added.add(msg.receiver);

          if (msg.sender !== userId) {
            const userQuery = await db.query(
              "SELECT  name,id,channel FROM users WHERE id = $1 LIMIT 1",
              [msg.sender]
            );
            if (rowCount(userQuery.rowCount)) {
              msg.contact = userQuery.rows[0];
            }
          } else {
            const userQuery = await db.query(
              "SELECT  name,id,channel FROM users WHERE id = $1 LIMIT 1",
              [msg.receiver]
            );
            if (rowCount(userQuery.rowCount)) {
              msg.contact = userQuery.rows[0];
            }
          }

          messages.push(msg);
        }
      }
      res.json({ status: "success", data: messages });
    } else {
      res.json({ status: "error", error: "An error occurred" });
    }
  } catch (err: any) {
    console.log(err.message);
    res.json({ status: "error", error: "Internal server error" });
  }
});

app.post("/private-message", async (req: Request, res: Response) => {
  const sender = req.body.sender;
  const receiver = req.body.receiver;
  let rows: any[] = [];
  try {
    const query = await db.query(
      "SELECT * FROM messages WHERE (sender=$1 AND receiver=$2) OR (sender=$3 AND receiver=$4) ORDER BY created_at DESC LIMIT 10",
      [sender, receiver, receiver, sender]
    );
    if (rowCount(query.rowCount) > 0) {
      rows = query.rows;
    }
  } catch (err: any) {
    console.log(err.message);
    res.json({ status: "error", error: "Internal server error" });
    return;
  }

  res.json({ status: "success", data: rows.reverse() });
});

server.listen(port, host, () => {
  console.log(`server is running on  http://${host}:${port}`);
});

app.post("/private-message", async (req: Request, res: Response) => {});
