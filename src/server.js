import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import listEndpoints from "express-list-endpoints";
import { createServer } from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { badRequestErrorHandler, catchAllErrorHandler, forbiddenErrorHandler, notFoundErrorHandler, unAuthorizedHandler } from "./errorHandlers.js";
import RoomModel from "./models/Room/index.js";
import chatRouter from "./services/Chat.js";
import usersRouter from "./services/users.js";

const app = express();
const port = process.env.PORT;

// **************** MIDDLEWARES ****************
app.use(express.json());
app.use(cookieParser());

// ******** loggerMiddleware ************
const loggerMiddleware = (req, res, next) => {
  console.log(`Request method: ${req.method} ${req.url} -- ${new Date()}`)
  next()
}
app.use(loggerMiddleware)

// ******** cors ************
const whitelist = [process.env.FRONTEND_LOCAL_URL, process.env.FRONTEND_REMOTE_URL]
const corsOptions = {
  origin: function (origin, next) {
    console.log("ORIGIN ", origin)
    if (whitelist.indexOf(origin) !== -1) {
      // origin allowed
      next(null, true)
    } else {
      // origin not allowed
      next(new Error("CORS TROUBLES!!!!!"))
    }
  }, credentials: true
}
app.use(cors(corsOptions))

// ******** ROUTES ************
app.use("/users", usersRouter);
app.use('/', chatRouter)

const server = createServer(app);
const io = new Server(server, { allowEIO3: true });

export const sockets = {}

io.on('connection', (socket) => {
  socket.on('did-connect', async (userId) => {
    sockets[userId] = socket
    try {
      const rooms = await RoomModel.find({ members: userId })
      for (let room of rooms) socket.join(room._id.toString())
    } catch (error) {
      console.log('error:', error)
    }
  })

  socket.on("joinRoom", async (roomId) => {
    socket.join(roomId);
  });

  socket.on("sendMessage", async ({ message, roomId }) => {
    socket.join(roomId)
    const room = await RoomModel.findById(roomId)

    await RoomModel.findOneAndUpdate({ _id: roomId }, {
      $push: { chatHistory: message }
    })
    socket.to(roomId).emit("message", message)
  })

  socket.on("disconnect", (userId) => {
    delete sockets[userId]
    console.log("disconnected")
  })
})

// Add "event listeners" on your socket when it's connecting
// io.on("connection", socket => {
//   console.log('***************** Socket *******************')
//   socket.on("validation", async ({ token, username }) => {
//     // VALIDATION:
//     console.log('token:', token)
//     console.log('username:', username)
//     if (token && username) {
//       const content = await verifyToken(token);
//       const user = await UserModel.findById(content._id);
//       if (user.username === username) {
//         console.log('Socket is connected and validatoin is OK')
//         socket.id = user._id

//         // Create his or her room in the Room Collection
//         const _room_ = await RoomModel.findOne({ name: username })
//         if (!_room_) {
//           try {
//             const newRoom = new RoomModel({ name: username })
//             const { _id } = await newRoom.save()
//             socket.join(username)
//             // Create his or her room in the users Collection
//             const userRooms = user.rooms.filter(r => r.toString() === _id.toString())
//             if (userRooms.length === 0) {
//               user.rooms.push(_id.toString())
//               await user.save()
//             }
//             console.log('user.rooms:', user.rooms)
//           } catch (error) {
//             console.log(error)
//           }
//         } else {
//           socket.join(username)
//         }

//         const userByRooms = await UserModel.find().populate("rooms")
//         console.log('rooms in DB:', userByRooms[0].rooms)
//         socket.emit("rooms", { rooms: userByRooms[0].rooms })

//         console.log('socket.rooms:', socket.rooms)
//         console.log('socket.id:', socket.id)
//         console.log(`**************************************`)

//         //   socket.on("sendMessage", async ({ message, room }) => {

//         //     await RoomModel.findOneAndUpdate({ name: room }, {
//         //         $push: { chatHistory: message }
//         //     })

//         //     socket.to(room).emit("message", message)
//         // })

//       }
//     } else {
//       console.log('validation failed')
//       socket.emit("validationFailed")
//     }
//     socket.on("disconnect", () => {
//       console.log(`${socket.id} disconnect`)
//     })
//   })
// })


// ******** ERROR MIDDLEWARES ************
app.use(unAuthorizedHandler);
app.use(notFoundErrorHandler);
app.use(badRequestErrorHandler);
app.use(forbiddenErrorHandler);
app.use(catchAllErrorHandler);

mongoose.connect(process.env.MONGO_CONNECTION, { useNewUrlParser: true }).then(() => {
  console.log("Connected to mongo");
  server.listen(port, () => {
    console.table(listEndpoints(app));
    console.log("Server listening on port " + port);
  });
});

