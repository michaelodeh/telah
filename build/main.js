"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
var passwordHash = require("password-hash");
require("dotenv").config();
const config_1 = __importStar(require("./db/config"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const port = Number(process.env.PORT || 3001);
const host = process.env.SERVER_HOST || undefined;
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
function empty(data) {
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
const md5_1 = require("./md5");
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield config_1.default.connect();
}))();
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
});
io.on("connection", (socket) => {
    console.log("a user connected");
    socket.on("send-message", (message) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        console.log(message.channel);
        const date = new Date();
        const d = date.getDate();
        const m = date.getMonth();
        const y = date.getFullYear();
        const createdAt = Date.now();
        try {
            const query = yield config_1.default.query("INSERT INTO messages (id,text, sender,receiver, channel,d,m,y,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [
                message.id,
                message.text,
                message.sender,
                message.receiver,
                message.channel,
                d,
                m,
                y,
                createdAt,
            ]);
            if ((0, config_1.rowCount)(query.rowCount) > 0) {
                console.log(`message sent successfully ${message}`);
                if (empty(message.channel) || empty(message.text))
                    return;
                socket.to((_a = message.channel) !== null && _a !== void 0 ? _a : "").emit(`receive-message`, {
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
        }
        catch (error) {
            console.log(error);
        }
    }));
    socket.on("join_private_channel", (data) => {
        socket.join(data.channel);
        console.log(`${socket.id} joined ${data.channel}`);
    });
});
app.get("/", (req, res) => {
    res.send("hello world");
});
app.post("/register", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = req.body;
    const id = (0, md5_1.randomMd5)();
    const channel = (0, md5_1.randomMd5)();
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
        const query = yield config_1.default.query("SELECT id FROM users WHERE phone=$1 LIMIT 1", [data.phone]);
        if ((0, config_1.rowCount)(query.rowCount) > 0) {
            ready = false;
            errorMessage = "Phone number already exists";
        }
        if (ready) {
            const query = yield config_1.default.query("INSERT INTO users (id,name, phone, channel, password) VALUES ($1,$2,$3,$4,$5)", [id, data.name, data.phone, channel, password]);
            if ((0, config_1.rowCount)(query.rowCount) > 0) {
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
            }
            else {
                res.json({ status: "error", error: "An error occurred" });
            }
        }
        else {
            res.json({ status: "error", error: errorMessage });
        }
    }
    catch (error) {
        console.error("Error:", error.message);
        res.json({ status: "error", error: "Internal server error" });
    }
}));
app.get("/chat", (req, res) => {
    res.sendFile("file.html", { root: __dirname });
});
// Function to fetch user by phone number
app.post("/login", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
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
            const query = yield config_1.default.query("SELECT * FROM users WHERE phone=$1 LIMIT 1", [data.phone]);
            if (query.rowCount) {
                const row = query.rows[0];
                try {
                    const passwordMatch = passwordHash.verify(data.password, row.password);
                    if (passwordMatch) {
                        delete row.password;
                        res.json({ status: "success", data: row });
                    }
                    else {
                        res.json({ status: "error", error: "Incorrect password" });
                    }
                }
                catch (e) {
                    console.log(e);
                    res.json({ status: "error", error: "An error occurred" });
                }
            }
            else {
                res.json({ status: "error", error: "User not found" });
            }
        }
        catch (err) {
            console.log(err.message);
            res.json({ status: "error", error: "An error occurred" });
        }
    }
    else {
        res.json({ status: "error", error: errorMessage });
    }
}));
app.post("/users", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const data = req.body;
        const query = yield config_1.default.query("SELECT name,id,channel FROM users WHERE id <> $1", [data.user]);
        if (query.rowCount) {
            res.json({ status: "success", data: query.rows });
        }
        else {
            res.json({ status: "error", error: "An error occurred" });
        }
    }
    catch (err) {
        console.log(err.message);
        res.json({ status: "error", error: "Internal server error" });
    }
}));
app.post("/private-message", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const sender = req.body.sender;
    const receiver = req.body.receiver;
    let rows = [];
    try {
        const query = yield config_1.default.query("SELECT * FROM messages WHERE (sender=$1 AND receiver=$2) OR (sender=$3 AND receiver=$4) ORDER BY created_at DESC LIMIT 10", [sender, receiver, receiver, sender]);
        if ((0, config_1.rowCount)(query.rowCount) > 0) {
            rows = query.rows;
        }
    }
    catch (err) {
        console.log(err.message);
        res.json({ status: "error", error: "Internal server error" });
        return;
    }
    res.json({ status: "success", data: rows });
}));
server.listen(port, host, () => {
    console.log(`server is running on  http://${host}:${port}`);
});
app.post("/private-message", (req, res) => __awaiter(void 0, void 0, void 0, function* () { }));
