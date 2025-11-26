//jshint esversion:8

require("dotenv").config(); // Para leer la URI de MongoDB Atlas desde .env

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");

const app = express();

// EJS como motor de plantillas
app.set("view engine", "ejs");

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// =================== CONEXIÓN MONGODB ATLAS ===================

// La URI viene de la variable de entorno MONGODB_ATLAS_URI
// (definida en tu archivo .env y en Railway)
const MONGODB_ATLAS_URI = process.env.MONGODB_ATLAS_URI;

mongoose
  .connect(MONGODB_ATLAS_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Conectado a MongoDB Atlas ✅"))
  .catch((err) => console.error("Error conectando a MongoDB Atlas ❌", err));

// =================== ESQUEMAS Y MODELOS ===================

// Esquema para los items de la lista
const itemsSchema = {
  name: String
};

// Modelo para los items (colección "items")
const Item = mongoose.model("Item", itemsSchema);

// Items por defecto
const item1 = new Item({ name: "Welcome to your todolist!" });
const item2 = new Item({ name: "Hit the + button to add a new item." });
const item3 = new Item({ name: "<-- Hit this to delete an item." });

const defaultItems = [item1, item2, item3];

// Esquema para listas personalizadas (colección "lists")
const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);

// =================== RUTAS ===================

// GET "/" -> lista por defecto "Today"
app.get("/", async (req, res) => {
  try {
    const foundItems = await Item.find({});

    if (foundItems.length === 0) {
      await Item.insertMany(defaultItems);
      return res.redirect("/");
    }

    res.render("list", {
      listTitle: "Today",
      newListItems: foundItems
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("Error retrieving items");
  }
});

// GET "/:customListName" -> listas personalizadas (Work, Home, etc.)
app.get("/:customListName", async (req, res) => {
  const customListName = _.capitalize(req.params.customListName);

  try {
    const foundList = await List.findOne({ name: customListName });

    if (!foundList) {
      // Si no existe, la creamos con los items por defecto
      const list = new List({
        name: customListName,
        items: defaultItems
      });

      await list.save();
      res.redirect("/" + customListName);
    } else {
      // Si existe, la mostramos
      res.render("list", {
        listTitle: foundList.name,
        newListItems: foundList.items
      });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error finding the list");
  }
});

// POST "/" -> añadir item a "Today" o a una lista personalizada
app.post("/", async (req, res) => {
  const itemName = req.body.newItem;
  const listName = req.body.list;

  const item = new Item({ name: itemName });

  try {
    if (listName === "Today") {
      await item.save();
      res.redirect("/");
    } else {
      const foundList = await List.findOne({ name: listName });
      foundList.items.push(item);
      await foundList.save();
      res.redirect("/" + listName);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error saving the item");
  }
});

// POST "/delete" -> borrar item de "Today" o de una lista personalizada
app.post("/delete", async (req, res) => {
  const checkedItemId = req.body.checkbox; // id del item
  const listName = req.body.listName;      // "Today" o nombre de la lista

  try {
    if (listName === "Today") {
      await Item.findByIdAndDelete(checkedItemId);
      res.redirect("/");
    } else {
      await List.findOneAndUpdate(
        { name: listName },
        { $pull: { items: { _id: checkedItemId } } }
      );
      res.redirect("/" + listName);
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Error deleting the item");
  }
});

// Página About
app.get("/about", (req, res) => {
  res.render("about");
});

// =================== SERVIDOR ===================

const PORT = process.env.PORT || 3000;

app.listen(PORT, function () {
  console.log("Server started on port", PORT);
});