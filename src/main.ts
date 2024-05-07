import express, { Express, Request, Response } from "express";
import path from "path";
import http from "http";
import { Server } from "socket.io";
import sqlite3, { Database } from "sqlite3";
var passwordHash = require("password-hash");

const app: Express = express();
const server: http.Server = http.createServer(app);
const port: number = 3001;
// const host = "192.168.230.170";

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
import { channel } from "diagnostics_channel";
const dbPath = path.resolve("build", "database");
console.log(dbPath);
const db: Database = new sqlite3.Database(
  dbPath,
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log("Connected to the SQLite database.");
    }
  }
);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("send-message", (message: Partial<MessageType>) => {
    console.log(message.channel);
    const date = new Date();
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const createdAt = Date.now();
    db.run(
      "INSERT INTO messages (id,text, sender,receiver, channel,d,m,y,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
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
      ],
      function (err) {
        if (err) {
          return console.log(err.message);
        }
        console.log(`A row has been inserted with row id ${message.id}`);
      }
    );
    console.log(message);
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
      date: createdAt,
    });
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
    const existingUser = await checkUserExistence(data.phone);
    if (existingUser) {
      ready = false;
      errorMessage = "Phone number already exists";
    }

    if (ready) {
      await insertUser(id, data.name, data.phone, channel, password);
      res.json({
        status: "success",
        data: { id: id, channel: channel, name: data.name, phone: data.phone },
      });
    } else {
      res.json({ status: "error", error: errorMessage });
    }
  } catch (error: any) {
    console.error("Error:", error.message);
    res.status(500).json({ status: "error", error: "Internal server error" });
  }
});

async function checkUserExistence(phone: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.get("SELECT id FROM user WHERE phone=? LIMIT 1", [phone], (err, row) => {
      if (err) {
        reject(err);
      }
      resolve(!!row);
    });
  });
}

async function insertUser(
  id: string,
  name: string,
  phone: string,
  channel: string,
  password: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO user (id,name, phone, channel, password) VALUES (?,?,?,?,?)",
      [id, name, phone, channel, password],
      (err) => {
        if (err) {
          reject(err);
        }
        console.log(`A row has been inserted with row id ${id}`);
        resolve();
      }
    );
  });
}

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
function getUserByPhone(phone: string): Promise<UserRow | null> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM user WHERE phone=? LIMIT 1",
      [phone],
      (err, row: UserRow) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      }
    );
  });
}

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
      const row: any = await getUserByPhone(data.phone);
      if (!row) {
        res.json({ status: "error", error: "User not found" });
      } else {
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
  async function getUsers(): Promise<any> {
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT name,id,channel FROM user WHERE id <> ?",
        [req.body.user],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
  const users = await getUsers();
  res.json({ status: "success", data: users });
});

app.post("/private-message", async (req: Request, res: Response) => {
  async function getMessages(): Promise<any> {
    const sender = req.body.sender;
    const receiver = req.body.receiver;
    return new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY created_at DESC LIMIT 10",
        [sender, receiver, receiver, sender],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }
  const messages = await getMessages();
  res.json({ status: "success", data: messages });
});

server.listen(port, () => {
  //console.log(`server is running on  http://${host}:${port}`);
});
