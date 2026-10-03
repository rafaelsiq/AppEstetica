require("dotenv").config();
const mongoose = require("mongoose");
const { ApolloServer } = require("apollo-server");
const typeDefs = require("./typeDefs");
const resolvers = require("./resolvers");

const dbUri =
  process.env.DB_URI ||
  `mongodb://${process.env.DB_HOST || "localhost:27017"}/${process.env.DB_NAME || "app-estetica"}`;

mongoose
  .connect(dbUri)
  .then(() => console.log("Database connected"))
  .catch((error) => console.log("Database failed: ", error));

const server = new ApolloServer({ typeDefs, resolvers });
server
  .listen({ port: Number(process.env.PORT || 4000) })
  .then(({ url }) => console.log(`Server ready at ${url}`))
  .catch((error) => console.log("Server failed: ", error));
