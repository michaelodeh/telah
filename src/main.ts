import express, { Express, Request, Response } from "express";
import http from "http";
import { Server } from "socket.io";

const app: Express = express();
const server: http.Server = http.createServer(app);
const port: number = 3001;
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:3000", "https://admin.socket.io"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("a user connected");
  socket.on("send-message", (message: MessageType) => {
    console.log(message.room);

    socket.broadcast.to(message.room).emit("receive-message", {
      text: message.text,
      sender: socket.id,
    });
  });
  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`${socket.id} joined ${room}`);
  });
});

app.get("/", (req: Request, res: Response) => {
  res.send("hello world");
});

app.get("/chat", (req: Request, res: Response) => {
  res.sendFile("file.html", { root: __dirname });
});

server.listen(port, () => {
  console.log(`server is running on port ${port}`);
});
