const {Pool}=require('pg');
require("dotenv").config();

const configuracion={
    user:process.env.PGUSER,
    host:process.env.PGHOST,
    database:process.env.PGDATABASE,
    password:process.env.PGPASSWORD
}

const conexion = new Pool({
    connectionString:process.env.DATABASE_URL
})

module.exports={conexion}