const express = require('express');
const path = require('path');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const session = require('express-session');
const multer = require('multer');
const app = express();
const port = 3000;

// Configurar la conexión a la base de datos
const connection = mysql.createConnection({
    host: '10.0.6.39',
    user: 'estudiante',
    password: 'Info-2023',
    database: 'HeladeriaS'
});

connection.connect((err) => {
    if (err) {
        console.error('Error de conexión a la base de datos: ' + err.stack);
        return;
    }
    console.log('Conexión exitosa a la base de datos.');
});

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'pagina_principal')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Configurar multer para manejar las subidas de archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware para proteger rutas
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    } else {
        res.redirect('/login.html');
    }
}

// Ruta raíz para redirigir a login si no está autenticado
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// Ruta para servir `index.html` solo si está autenticado
app.get('/index.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'pagina_principal/index.html'));
});

// Ruta para servir `listardatos.html` solo si está autenticado
app.get('/listardatos.html', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'pagina_principal/listardatos.html'));
});

// Ruta de registro de usuario
app.post('/register', (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
    connection.query(sql, [username, hashedPassword], (err, result) => {
        if (err) {
            console.error('Error al registrar usuario:', err);
            res.status(500).send('Error al registrar usuario');
            return;
        }
        res.redirect('/login.html');
    });
});

// Ruta de inicio de sesión
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ?';
    connection.query(sql, [username], (err, results) => {
        if (err) {
            console.error('Error al iniciar sesión:', err);
            res.status(500).send('Error al iniciar sesión');
            return;
        }
        if (results.length === 0) {
            res.status(401).send('Usuario no encontrado');
            return;
        }
        const user = results[0];
        if (bcrypt.compareSync(password, user.password)) {
            req.session.userId = user.id;
            res.redirect('/index.html');
        } else {
            res.status(401).send('Contraseña incorrecta');
        }
    });
});

// Ruta para cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            res.status(500).send('Error al cerrar sesión');
            return;
        }
        res.redirect('/login.html');
    });
});

// Ruta protegida para guardar helado
app.post('/guardar_helado', isAuthenticated, upload.single('imagen'), (req, res) => {
    const { nombre, descripcion, sabor, tipo, cobertura, precio } = req.body;
    const imagen = req.file ? `/uploads/${req.file.filename}` : null;
    const sql = 'INSERT INTO Helado (nombre, descripcion, sabor, tipo, cobertura, precio, imagen) VALUES (?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [nombre, descripcion, sabor, tipo, cobertura, precio, imagen], (err, result) => {
        if (err) throw err;
        console.log('Helado insertado correctamente.');
        res.redirect('/listardatos.html');
    });
});

app.get('/helados', isAuthenticated, (req, res) => {
    connection.query('SELECT * FROM Helado', (err, rows) => {
        if (err) throw err;
        res.send(rows);
    });
});

app.get('/helado_especifico/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM Helado WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error al obtener los datos del helado:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        if (result.length === 0) {
            res.status(404).send('Helado no encontrado');
            return;
        }
        res.json(result[0]);
    });
});

app.delete('/helados/:id', isAuthenticated, (req, res) => {
    const id = req.params.id;
    connection.query('DELETE FROM Helado WHERE id = ?', [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar el helado:', err);
            res.status(500).send('Error interno del servidor');
            return;
        }
        if (result.affectedRows === 0) {
            res.status(404).send('Helado no encontrado');
            return;
        }
        res.send('Helado eliminado');
    });
});

// Servidor ejecutándose en el puerto 3000
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
