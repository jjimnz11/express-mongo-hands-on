//jshint esversion:8

require("dotenv").config(); // Lee MONGODB_ATLAS_URI del .env

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3000;

// ======== CONFIGURACIÓN EJS Y STATIC ========

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// ======== CONEXIÓN MONGODB ATLAS ========
// La URI la tienes en el .env como MONGODB_ATLAS_URI
const uri = process.env.MONGODB_ATLAS_URI;
console.log("DEBUG Railway MONGODB_ATLAS_URI definida:", !!uri);

mongoose
  .connect(uri)
  .then(() => console.log("Conectado a MongoDB Atlas ✅"))
  .catch((err) => console.error("Error conectando a MongoDB Atlas ❌", err));

// ======== ESQUEMAS Y MODELOS ========

// Colección "items" -> lista GENERAL
const itemsSchema = {
  name: String
};

const Item = mongoose.model("Item", itemsSchema);

// Colección "lists" -> listas personalizadas, usaremos una: "Trabajo"
const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);

// Items por defecto para la lista general
const defaultItems = [
  new Item({ name: "Bienvenido a tu ToDoList de Jesús ✨" }),
  new Item({ name: "Escribe una tarea y pulsa +" }),
  new Item({ name: "Marca la casilla para eliminarla" })
];

// Asegurarnos de que hay datos iniciales
async function ensureDefaultData() {
  // Si la colección items está vacía, ponemos los tres por defecto
  const countItems = await Item.countDocuments({});
  if (countItems === 0) {
    await Item.insertMany(defaultItems);
  }

  // Si no existe la lista "Trabajo", la creamos vacía
  const workList = await List.findOne({ name: "Trabajo" });
  if (!workList) {
    await new List({ name: "Trabajo", items: [] }).save();
  }
}

// ================== RUTAS ==================

// Mostrar LAS DOS listas en la misma página
app.get("/", async (req, res) => {
  try {
    await ensureDefaultData();

    const [generalItems, workList] = await Promise.all([
      Item.find({}).lean(),
      List.findOne({ name: "Trabajo" }).lean()
    ]);

    const workItems = workList ? workList.items : [];

    res.render("list", {
      generalItems,
      workItems
    });
  } catch (err) {
    console.error("Error en GET /", err);
    res.status(500).send("Error cargando listas");
  }
});

// Redirigir /work a la pantalla única
app.get("/work", (req, res) => {
  res.redirect("/");
});

// About
app.get("/about", (req, res) => {
  res.render("about", { pageTitle: "Sobre esta app" });
});

// ----------------- AÑADIR TAREA -----------------
app.post("/", async (req, res) => {
  const itemName = req.body.newItem; // texto de la tarea
  const listName = req.body.list;    // "General" o "Trabajo"

  if (!itemName || !listName) {
    return res.redirect("/");
  }

  const text = itemName.trim();
  if (!text) {
    return res.redirect("/");
  }

  try {
    if (listName === "General") {
      // Guardamos en colección "items"
      await new Item({ name: text }).save();
    } else if (listName === "Trabajo") {
      // Añadimos al array items de la lista "Trabajo" en colección "lists"
      await List.findOneAndUpdate(
        { name: "Trabajo" },
        { $push: { items: { name: text } } },
        { upsert: true }
      );
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error en POST / (add)", err);
    res.redirect("/");
  }
});

// ----------------- BORRAR TAREA -----------------
app.post("/delete", async (req, res) => {
  const checkedItemId = req.body.checkbox; // _id del item
  const listName = req.body.listName;      // "General" o "Trabajo"

  console.log("BORRANDO =>", listName, checkedItemId);

  if (!checkedItemId || !listName) {
    return res.redirect("/");
  }

  try {
    if (listName === "General") {
      // Borramos directamente de "items"
      await Item.findByIdAndDelete(checkedItemId);
    } else if (listName === "Trabajo") {
      // Borramos del array items de la lista "Trabajo"
      await List.findOneAndUpdate(
        { name: "Trabajo" },
        { $pull: { items: { _id: checkedItemId } } }
      );
    }
    res.redirect("/");
  } catch (err) {
    console.error("Error en POST /delete", err);
    res.redirect("/");
  }
});

// 404 simple
app.use((req, res) => {
  res.status(404).render("about", {
    pageTitle: "Página no encontrada"
  });
});

app.listen(3000, function() {
  console.log("Server started on port 3000");
});