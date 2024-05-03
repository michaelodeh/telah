"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const port = 3001;
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["http://localhost:3000", "https://admin.socket.io"],
        methods: ["GET", "POST"],
        credentials: true,
    },
});
io.on("connection", (socket) => {
    console.log("a user connected");
    // socket.join("30")
    socket.on("send-message", (message) => {
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
app.get("/", (req, res) => {
    res.send("hello world");
});
app.get("/chat", (req, res) => {
    res.sendFile("file.html", { root: __dirname });
});
server.listen(port, () => {
    console.log(`server is running on port ${port}`);
});
