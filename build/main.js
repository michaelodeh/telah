"use strict";
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
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const sqlite3_1 = __importDefault(require("sqlite3"));
var passwordHash = require("password-hash");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const port = 3001;
// const host = "192.168.230.170";
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
const dbPath = path_1.default.resolve("build", "database");
console.log(dbPath);
const db = new sqlite3_1.default.Database(dbPath, sqlite3_1.default.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    else {
        console.log("Connected to the SQLite database.");
    }
});
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    },
});
io.on("connection", (socket) => {
    console.log("a user connected");
    socket.on("send-message", (message) => {
        var _a;
        console.log(message.channel);
        const date = new Date();
        const d = date.getDate();
        const m = date.getMonth();
        const y = date.getFullYear();
        const createdAt = Date.now();
        db.run("INSERT INTO messages (id,text, sender,receiver, channel,d,m,y,created_at) VALUES (?,?,?,?,?,?,?,?,?)", [
            message.id,
            message.text,
            message.sender,
            message.receiver,
            message.channel,
            d,
            m,
            y,
            createdAt,
        ], function (err) {
            if (err) {
                return console.log(err.message);
            }
            console.log(`A row has been inserted with row id ${message.id}`);
        });
        console.log(message);
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
            date: createdAt,
        });
    });
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
        const existingUser = yield checkUserExistence(data.phone);
        if (existingUser) {
            ready = false;
            errorMessage = "Phone number already exists";
        }
        if (ready) {
            yield insertUser(id, data.name, data.phone, channel, password);
            res.json({
                status: "success",
                data: { id: id, channel: channel, name: data.name, phone: data.phone },
            });
        }
        else {
            res.json({ status: "error", error: errorMessage });
        }
    }
    catch (error) {
        console.error("Error:", error.message);
        res.status(500).json({ status: "error", error: "Internal server error" });
    }
}));
function checkUserExistence(phone) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            db.get("SELECT id FROM user WHERE phone=? LIMIT 1", [phone], (err, row) => {
                if (err) {
                    reject(err);
                }
                resolve(!!row);
            });
        });
    });
}
function insertUser(id, name, phone, channel, password) {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            db.run("INSERT INTO user (id,name, phone, channel, password) VALUES (?,?,?,?,?)", [id, name, phone, channel, password], (err) => {
                if (err) {
                    reject(err);
                }
                console.log(`A row has been inserted with row id ${id}`);
                resolve();
            });
        });
    });
}
app.get("/chat", (req, res) => {
    res.sendFile("file.html", { root: __dirname });
});
// Function to fetch user by phone number
function getUserByPhone(phone) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM user WHERE phone=? LIMIT 1", [phone], (err, row) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(row);
            }
        });
    });
}
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
            const row = yield getUserByPhone(data.phone);
            if (!row) {
                res.json({ status: "error", error: "User not found" });
            }
            else {
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
    function getUsers() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                db.all("SELECT name,id,channel FROM user WHERE id <> ?", [req.body.user], (err, rows) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(rows);
                    }
                });
            });
        });
    }
    const users = yield getUsers();
    res.json({ status: "success", data: users });
}));
app.post("/private-message", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    function getMessages() {
        return __awaiter(this, void 0, void 0, function* () {
            const sender = req.body.sender;
            const receiver = req.body.receiver;
            return new Promise((resolve, reject) => {
                db.all("SELECT * FROM messages WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?) ORDER BY created_at DESC LIMIT 10", [sender, receiver, receiver, sender], (err, rows) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(rows);
                    }
                });
            });
        });
    }
    const messages = yield getMessages();
    res.json({ status: "success", data: messages });
}));
server.listen(port, () => {
    //console.log(`server is running on  http://${host}:${port}`);
});
