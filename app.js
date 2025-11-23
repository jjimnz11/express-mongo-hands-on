const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// VIEW ENGINE
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// MIDDLEWARE
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// === "BASE DE DATOS" EN MEMORIA ===
const taskLists = new Map([
  ["General", []],
  ["Trabajo", []]
]);

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getList(name) {
  if (!taskLists.has(name)) {
    taskLists.set(name, []);
  }
  return taskLists.get(name);
}

// ================== RUTAS ==================

// Mostrar LAS DOS listas en la misma página
app.get("/", (req, res) => {
  res.render("list", {
    generalItems: getList("General"),
    workItems: getList("Trabajo")
  });
});

// Si alguien va a /work, lo mandamos a la pantalla única
app.get("/work", (req, res) => {
  res.redirect("/");
});

// About
app.get("/about", (req, res) => {
  res.render("about", { pageTitle: "Sobre esta app" });
});

// ----------------- AÑADIR TAREA -----------------
app.post("/", (req, res) => {
  const itemName = req.body.newItem; 
  const listName = req.body.list;    

  if (!itemName || !listName) {
    return res.redirect("/");
  }

  const text = itemName.trim();
  if (!text) {
    return res.redirect("/");
  }

  const newTask = {
    id: generateId(),
    name: text
  };

  const list = getList(listName);
  list.push(newTask);

  // Siempre volvemos a la página principal, que muestra las dos listas
  res.redirect("/");
});

// ----------------- BORRAR TAREA -----------------
app.post("/delete", (req, res) => {
  const checkedItemId = req.body.checkbox; 
  const listName = req.body.listName;      

  console.log("BORRANDO =>", listName, checkedItemId);

  if (!checkedItemId || !listName) {
    return res.redirect("/");
  }

  const list = getList(listName);
  const updatedList = list.filter(item => item.id !== checkedItemId);
  taskLists.set(listName, updatedList);

  // De nuevo, siempre recargamos la pantalla con las dos listas
  res.redirect("/");
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