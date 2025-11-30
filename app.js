//jshint esversion:8

require("dotenv").config(); // Lee MONGODB_ATLAS_URI del .env

const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const mongoose = require("mongoose");

const app = express();

// ======== CONFIGURACIÓN EJS Y STATIC ========

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// ======== CONEXIÓN MONGODB ATLAS ========

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

// Colección "lists" -> listas personalizadas (usaremos "Trabajo" + dinámicas tipo /Pepito)
const listSchema = {
  name: String,
  items: [itemsSchema]
};

const List = mongoose.model("List", listSchema);

// Items por defecto para listas nuevas
const defaultItems = [
  new Item({ name: "Bienvenido a tu ToDoList de Jesús ✨" }),
  new Item({ name: "Escribe una tarea y pulsa +" }),
  new Item({ name: "Marca la casilla para eliminarla" })
];

// Asegurarnos de que hay datos iniciales en General y Trabajo
async function ensureDefaultData() {
  // Si la colección items está vacía, ponemos los tres por defecto en GENERAL
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

// Mostrar LAS DOS listas en la misma página (General + Trabajo)
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

// ====== NUEVO: LISTAS DINÁMICAS POR URL ( /Pepito, /Viajes, /Examenes, etc.) ======
app.get("/:customListName", async (req, res) => {
  const customListNameRaw = req.params.customListName;

  // Para evitar problemas con /favicon.ico y rutas conocidas
  if (customListNameRaw === "favicon.ico") {
    return res.status(204).end();
  }
  if (["about", "work"].includes(customListNameRaw)) {
    return res.redirect("/" + customListNameRaw);
  }

  // Capitalizamos un poco el nombre (Pepito, Viajes...)
  const customListName =
    customListNameRaw.charAt(0).toUpperCase() + customListNameRaw.slice(1);

  try {
    let foundList = await List.findOne({ name: customListName });

    if (!foundList) {
      // Si no existe, la creamos con los items por defecto
      const list = new List({
        name: customListName,
        items: defaultItems
      });
      foundList = await list.save();
    }

    res.render("customList", {
      listTitle: foundList.name,
      newListItems: foundList.items
    });
  } catch (err) {
    console.error("Error en GET /:customListName", err);
    res.status(500).send("Error cargando la lista personalizada");
  }
});

// ----------------- AÑADIR TAREA -----------------
app.post("/", async (req, res) => {
  const itemName = req.body.newItem; // texto de la tarea
  const listName = req.body.list;    // "General", "Trabajo" o cualquier nombre de lista dinámica

  if (!itemName || !listName) {
    return res.redirect("/");
  }

  const text = itemName.trim();
  if (!text) {
    return res.redirect("/");
  }

  try {
    if (listName === "General") {
      // Guardamos en colección "items" (lista general)
      await new Item({ name: text }).save();
    } else {
      // Trabajo o cualquier lista dinámica -> colección "lists"
      await List.findOneAndUpdate(
        { name: listName },
        { $push: { items: { name: text } } },
        { upsert: true }
      );
    }

    // Si es General o Trabajo, volvemos a la home
    if (listName === "General" || listName === "Trabajo") {
      res.redirect("/");
    } else {
      // Si es una lista dinámica, volvemos a su URL /Pepito
      res.redirect("/" + listName);
    }
  } catch (err) {
    console.error("Error en POST / (add)", err);
    res.redirect("/");
  }
});

// ----------------- BORRAR TAREA -----------------
app.post("/delete", async (req, res) => {
  const checkedItemId = req.body.checkbox; // _id del item
  const listName = req.body.listName;      // "General", "Trabajo" o nombre de lista dinámica

  console.log("BORRANDO =>", listName, checkedItemId);

  if (!checkedItemId || !listName) {
    return res.redirect("/");
  }

  try {
    if (listName === "General") {
      // Borramos directamente de "items"
      await Item.findByIdAndDelete(checkedItemId);
      res.redirect("/");
    } else {
      // Trabajo o cualquier lista dinámica -> borrar del array items en "lists"
      await List.findOneAndUpdate(
        { name: listName },
        { $pull: { items: { _id: checkedItemId } } }
      );

      if (listName === "Trabajo") {
        res.redirect("/");
      } else {
        res.redirect("/" + listName);
      }
    }
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});