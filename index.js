const express = require("express");
const bodyParser = require("body-parser");
const { default: mongoose } = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const path = require("path");



const app = express();
const port = 8000;
const cors = require("cors");
app.use(cors());


app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(passport.initialize());
const jwt = require("jsonwebtoken");

const defaultUserImage =
  "https://img.freepik.com/free-psd/3d-illustration-person-with-sunglasses_23-2149436188.jpg?w=740&t=st=1695743723~exp=1695744323~hmac=4d6be87de3922dfabc655661c703e64977a02e24c03ae41905cd99a8d9114c0f";

mongoose
  .connect("mongodb+srv://jodduser:jodduser@cluster0.hd4qsmk.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB", err);
  });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
//testing
// Define a route to serve static files from the "files/" directory
app.use("/files", express.static(path.join(__dirname, "files")));

//testing-end
const User = require("./models/user");
const Message = require("./models/message");
const multer = require("multer");

//function to create a token for the user
const createToken = (userId) => {
  //set the token payload
  const payload = {
    userId: userId,
  };
  //sign the token
  return jwt.sign(payload, "Q$r2K6W8n!jCW%Zk", {
    expiresIn: 3600,
  });
};

//endpoint for registration of user

app.post("/register", (req, res) => {
  const { name, email, password, image } = req.body;

  //create a new user object
  const newUser = new User({
    name,
    email,
    password,
    image: image || defaultUserImage,
  });

  //save the user to the database
  newUser
    .save()
    .then(() => {
      res.status(200).json({ message: "User registered successfully" });
    })
    .catch((err) => {
      console.log("Error registering the user", err);
      res.status(500).json({ message: "Error registering user" });
    });
});

//endpoint for login of the user
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  //check if the email and password are provided
  if (!email || !password) {
    return res.status(404).json({ message: "email and password are required" });
  }

  //check for that user in the database
  User.findOne({ email })
    .then((user) => {
      if (!user) {
        //user not found
        return res.status(404).json({ message: "User not found" });
      }
      //check if the password matches
      if (user.password != password) {
        return res.status(404).json({ message: "Invalid Password" });
      }
      //if the password matches, create a token
      const token = createToken(user._id);
      res.status(200).json({ token });
    })
    .catch((err) => {
      console.log("Error in finding the user");
      res.status(500).json({ message: "Internal server error !" });
    });
});

//endpoint to access all the users expect the user who is currently logged in

app.get("/users/:userId", (req, res) => {
  const loggedInUserId = req.params.userId;
  User.find({ _id: { $ne: loggedInUserId } })
    .then((users) => {
      res.status(200).json(users);
    })
    .catch((error) => {
      console.log("Error retrieving users", error);
      res.status(500).json({ message: "error retrieving users" });
    });
});

// A new endpoint to fetch the username of the currently logged-in user
app.get("/username/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch the user data from the user ID and return the username
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const username = user.name;
    res.status(200).json({ username });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Endpoint to get the user's image by user ID
app.get("/user-image/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch the user data from the user ID and return the image URL
    const user = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userImage = user.image || defaultUserImage; // Get the user's image URL

    res.status(200).json({ userImage });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to send a request to a user
app.post("/friend-request", async (req, res) => {
  const { currentUserId, selectedUserId } = req.body;

  try {
    //update the recipient's friendRequests array
    await User.findByIdAndUpdate(selectedUserId, {
      $push: { friendRequests: currentUserId },
    });

    //update the sender's sentFriendRequests array
    await User.findByIdAndUpdate(currentUserId, {
      $push: { sentFriendRequests: selectedUserId },
    });

    res.sendStatus(200);
  } catch (error) {
    console.log("Error sending friend request", error);
    res.sendStatus(500);
  }
});

//endpoint to show all the friend-requests of a particular user

app.get("/friend-request/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    //fetch the user document based on the User ID
    const user = await User.findById(userId)
      .populate("friendRequests", "name email image")
      .lean();

    const friendRequests = user.friendRequests;

    res.json(friendRequests);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to accept a friend request

app.post("/accept-friend-request", async (req, res) => {
  try {
    const { senderId, recipientId } = req.body;

    //fetch the user document of sender and recipient
    const sender = await User.findById(senderId);
    const recipient = await User.findById(recipientId);

    sender.friends.push(recipientId);
    recipient.friends.push(senderId);

    recipient.friendRequests = recipient.friendRequests.filter(
      (request) => request.toString() !== senderId.toString()
    );
    sender.sentFriendRequests = sender.sentFriendRequests.filter(
      (request) => request.toString() !== recipientId.toString()
    );

    await sender.save();
    await recipient.save();
    res.status(200).json({ message: "Friend req accepted successfully!" });
  } catch (error) {
    console.log("Error accepting friend request", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to access all the friends of the logged in user
app.get("/accepted-friends/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).populate(
      "friends",
      "name email image"
    );
    const acceptedFriends = user.friends;
    res.json(acceptedFriends);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Define the directory where uploaded files will be stored
    cb(null, "files/");
  },
  filename: function (req, file, cb) {
    // Define how uploaded files will be named
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

//endpoint to post messages and store it on the backend
app.post("/messages", upload.single("imageFile"), async (req, res) => {
  try {
    const { senderId, recipientId, messageType, messageText } = req.body;

    const newMessage = new Message({
      senderId,
      recipientId,
      messageType,
      message: messageText,
      timeStamp: new Date(),
      imageUrl:
        messageType === "image" ? req.file.path.replace(/\\/g, "/") : null,
    });

    await newMessage.save();

    res.status(200).json({ message: "Message sent succesfully" });
  } catch (error) {
    console.log("Error on file upload", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to ge the userDetails to design the chat room header

app.get("/user-details/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    //fetch the user data from the user id
    const recepientId = await User.findById(userId); /* .populate(
      "friends",
      "name email image"
    ); */
    res.json(recepientId);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to get all the messages between two users in the chat room

app.get("/messages/:senderId/:recipientId", async (req, res) => {
  try {
    const { senderId, recipientId } = req.params;

    //fetch the user data from the user id
    const messages = await Message.find({
      $or: [
        { senderId, recipientId },
        { senderId: recipientId, recipientId: senderId },
      ],
    })
      .populate("senderId", "name _id")
      .lean();

    res.json(messages);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to deleete the messages

app.post("/deleteMessages", async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "Invalid req body!" });
    }

    await Message.deleteMany({ _id: { $in: messages } });

    res.json({ message: "Message deleted successfully!" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to fetch the sent friend requests of a particular user
app.get("/friend-requests/sent/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .populate("sentFriendRequests", "name email image")
      .lean();

    const sentFriendRequests = user.sentFriendRequests;
    res.json(sentFriendRequests);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//endpoint to fetch the friends of a particular user
app.get("/friends/:userId", (req, res) => {
  try {
    const { userId } = req.params;
    User.findById(userId)
      .populate("friends")
      .then((user) => {
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        const friendIds = user.friends.map((friend) => friend._id);

        res.status(200).json(friendIds);
      });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
