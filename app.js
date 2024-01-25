const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const { Sequelize, DataTypes } = require('sequelize');

const app = express();
app.use(bodyParser.json());

// Conexión a la base de datos
const host = "localhost";
const port = 3306;
const user = "root";
const password = "";
const dbname = "";

const sequelize = new Sequelize('mysql://root:Gcs210910!@localhost/tickets');

sequelize.authenticate()
  .then(() => {
    console.log('Conexión establecida con éxito.');
  })
  .catch(err => {
    console.error('No se pudo conectar a la base de datos:', err);
  });

const stripe = require('stripe')('sk_test_51OcJqXHdYIu651AJT9vXNrfcIRUpZgtiFUV6PEjZCCYQ9qYznrwKeCZgdcXaNDfGfO0PMxtGm3XoDLeCaUfK7hyw00WHzYMW1u');

// Definición del modelo de Usuario
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  }
});

// Definición del modelo de Boleto
const Ticket = sequelize.define('Ticket', {
  destination: {
    type: DataTypes.STRING,
    allowNull: false
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  }
});

// Definición del modelo de Vuelo
const Flight = sequelize.define('Flight', {
  origin: {
    type: DataTypes.STRING,
    allowNull: false
  },
  destination: {
    type: DataTypes.STRING,
    allowNull: false
  },
  departureTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  arrivalTime: {
    type: DataTypes.DATE,
    allowNull: false
  }
});

// Definición de las relaciones entre los modelos
User.hasMany(Ticket);
Ticket.belongsTo(User);

Flight.hasMany(Ticket);
Ticket.belongsTo(Flight);

// Sincronizar todos los modelos con la base de datos
sequelize.sync();

// Rutas de la API
app.post('/register', async (req, res) => {
  const { username, password } = req.body;

  // Verificar si el usuario ya existe
  const user = await User.findOne({ where: { username } });
  if (user) {
    return res.status(400).json({ message: 'El usuario ya existe' });
  }

  // Hashear la contraseña
  const hash = await bcrypt.hash(password, 10);

  // Crear el nuevo usuario
  await User.create({ username, password: hash });

  res.status(200).json({ message: 'Usuario registrado exitosamente' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Verificar si el usuario existe
  const user = await User.findOne({ where: { username } });
  if (!user) {
    return res.status(400).json({ message: 'El usuario no existe' });
  }

  // Comparar la contraseña
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: 'Contraseña incorrecta' });
  }

  // Iniciar la sesión del usuario
  // Aquí puedes implementar la lógica para generar y enviar un token JWT, por ejemplo

  res.status(200).json({ message: 'Inicio de sesión exitoso' });
});

app.get('/search', (req, res) => {
  // Recoger los criterios de búsqueda desde la consulta
  const { destination, date } = req.query;

  // Usar estos criterios para buscar en la base de datos los boletos que coincidan
  Ticket.find({ destination, date }, (err, tickets) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar los boletos' });
    }

    // Enviar una respuesta al cliente con los boletos encontrados
    res.status(200).json(tickets);
  });
});

app.post('/selectSeat', (req, res) => {
  const { seatNumber, ticketId } = req.body;

  // Verificar si el asiento ya está reservado
  Ticket.findById(ticketId, (err, ticket) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar el boleto' });
    }

    if (!ticket) {
      return res.status(400).json({ message: 'Boleto no encontrado' });
    }

    if (ticket.seatsReserved.includes(seatNumber)) {
      return res.status(400).json({ message: 'Asiento ya reservado' });
    }

    // Si el asiento no está reservado, marcarlo como reservado
    ticket.seatsReserved.push(seatNumber);

    // Guardar los cambios en la base de datos
    ticket.save(err => {
      if (err) {
        return res.status(500).json({ message: 'Error al guardar la reserva del asiento' });
      }

      // Enviar una respuesta al cliente indicando que la selección de asientos fue exitosa
      res.status(200).json({ message: 'Asiento seleccionado exitosamente' });
    });
  });
});

app.post('/makePayment', (req, res) => {
  const { amount, source } = req.body;

  // Verificar si los datos de pago son válidos
  // Esto puede incluir verificar si la cantidad es un número y si la fuente de pago es una cadena de caracteres

  if (typeof amount !== 'number' || typeof source !== 'string') {
    return res.status(400).json({ message: 'Datos de pago inválidos' });
  }

  // Procesar el pago utilizando Stripe
  stripe.charges.create({
    amount,
    currency: 'usd',
    source,
    description: 'Cargo por reserva de vuelo'
  }, (err, charge) => {
    if (err) {
      return res.status(500).json({ message: 'Error al procesar el pago' });
    }

    // Enviar una respuesta al cliente indicando que el pago fue exitoso
    res.status(200).json({ message: 'Pago realizado exitosamente' });
  });
});

app.get('/confirmation', (req, res) => {
  const { flightId } = req.query;

  // Buscar en la base de datos el vuelo que coincida con los datos proporcionados
  Flight.findById(flightId, (err, flight) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar el vuelo' });
    }

    if (!flight) {
      return res.status(400).json({ message: 'Vuelo no encontrado' });
    }

    // Generar una confirmación con los detalles del vuelo
    const confirmation = {
      flightNumber: flight.flightNumber,
      departure: flight.departure,
      arrival: flight.arrival,
      date: flight.date,
      // Aquí puedes agregar más detalles si lo deseas
    };

    // Enviar una respuesta al cliente con la confirmación generada
    res.status(200).json(confirmation);
  });
});

app.get('/flightTypes', (req, res) => {
  // Buscar en la base de datos todos los tipos de vuelo
  FlightType.find({}, (err, flightTypes) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar los tipos de vuelo' });
    }

    // Enviar una respuesta al cliente con los tipos de vuelo encontrados
    res.status(200).json(flightTypes);
  });
});

app.put('/flights/:id', (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  // Buscar en la base de datos el vuelo que coincida con el ID proporcionado
  Flight.findById(id, (err, flight) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar el vuelo' });
    }

    if (!flight) {
      return res.status(400).json({ message: 'Vuelo no encontrado' });
    }

    // Actualizar los detalles del vuelo con los datos proporcionados
    Object.assign(flight, updatedData);

    // Guardar los cambios en la base de datos
    flight.save(err => {
      if (err) {
        return res.status(500).json({ message: 'Error al guardar los cambios' });
      }

      // Enviar una respuesta al cliente indicando que la actualización fue exitosa
      res.status(200).json({ message: 'Vuelo actualizado exitosamente' });
    });
  });
});

app.get('/fares', (req, res) => {
  const sql = 'SELECT * FROM fares';

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ message: 'Error al buscar las tarifas' });
    }

    res.status(200).json(results);
  });
});

// Inicio del servidor
app.listen(3000, () => console.log('Servidor escuchando en el puerto 3000'));

