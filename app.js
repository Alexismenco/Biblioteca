const express=require('express');
const app=new express();
const {conexion} = require('./db');
const fs = require('fs');
const path = require('path')
const upload = require('express-fileupload');
const bodyparser = require("body-parser");
const nodemailer=require('nodemailer');
require('dotenv').config();
const chalk = require('chalk');
const jwt = require('./utils/jwt');
const {prevenirLogin ,permisosAdmin}=require('./middleware/autenticacion')
const { urlencoded } = require('express');

// configuracion nodmeailer
var transporter=nodemailer.createTransport({
  service:'gmail',
  auth:{
    user:process.env.MAILUSER,
    pass:process.env.MAILPASS
  }
})
app.use(express.urlencoded({extended:false}))
app.use(express.static('public'));
app.use(upload());
app.set('view engine',"ejs");
app.set("views",__dirname+"/views");

app.get('/', async (req,res) => {
  let consulta ='SELECT l."Id", l."Nombre" AS "Libro", a."Nombre" AS "Autor", l."Edicion" FROM "Libros" l JOIN "Autores" a ON l."IdAutor"=a."Id" '
    let resultado;
    
    try{
        resultado = await conexion.query(consulta)
    }catch (err){
        console.log("Error en la consulta: "+err.message);
        res.status(500);
        res.json({mensaje:"Error al buscar datos"})
    }
    // revisar si exites una foto asociada a cada libro, si no lo hay asociar la foto noimg
    let libros = resultado.rows;
    const listaArchivos = fs.readdirSync("public/img");
    libros.forEach(async l => {
        let archivo = listaArchivos.filter(a=>
            a.split(".")[0]==l.Id
        )
        if(archivo.length==0){
            l.ruta="img/noimg.jpg";
        } else {
            l.ruta="img/"+archivo[0];
        }
    });

    var rolAdmin=req.headers.cookie || false ;
    res.render('index',{libros:libros,rolAdmin:rolAdmin})
})


app.get('/galeria', async (req,res) => {
    let consulta ='SELECT l."Id", l."Nombre" AS "Libro", a."Nombre" AS "Autor", l."Edicion" FROM "Libros" l JOIN "Autores" a ON l."IdAutor"=a."Id" '
    let resultado;
    
    try{
        resultado = await conexion.query(consulta)
    }catch (err){
        console.log("Error en la consulta: "+err.message);
        res.status(500);
        res.json({mensaje:"Error al buscar datos"})
    }
    // revisar si exites una foto asociada a cada libro, si no lo hay asociar la foto noimg
    let libros = resultado.rows;
    const listaArchivos = fs.readdirSync("public/img");
    libros.forEach(async l => {
        let archivo = listaArchivos.filter(a=>
            a.split(".")[0]==l.Id
        )
        if(archivo.length==0){
            l.ruta="img/noimg.jpg";
        } else {
            l.ruta="img/"+archivo[0];
        }
    });
    var rolAdmin=req.headers.cookie || false ;
    res.render('galeria', {libros:libros, rolAdmin:rolAdmin});
})

app.get('/contacto', (req,res) => {
  var rolAdmin=req.headers.cookie || false ;
    res.render('contacto',{rolAdmin:rolAdmin})
})

app.get("/login",prevenirLogin, async function (req,res){
  var rolAdmin=req.headers.cookie || false ;
    res.render('login',{rolAdmin:rolAdmin})
  })


app.post("/login", async function (req,res){
  var consultaAdmin='SELECT "email","password" from "admin" WHERE "email"=$1 AND "password"=$2'
  const parametros=[req.body.email,req.body.password];
  var respuestaAdmin;

  try{
    respuestaAdmin = await conexion.query(consultaAdmin,parametros);
  } catch(err){
      console.log("Error consulta: "+err.message);
  }
    const email = req.body.email;
    const usuario = {
      email:email
    }
    if(respuestaAdmin.rows[0]){
    
      const token = await jwt.generarToken(usuario);
      res.cookie(process.env.JWT_COOKIE,token,{httpOnly:true});
      res.redirect('ingresoAutor');
      
    }
})



app.get("/ingresoLibros",permisosAdmin, async function (req,res){
    let consultaAutores = 'SELECT "Id", "Nombre" FROM "Autores"';
    let consultaGeneros = 'SELECT "Id", "Nombre" FROM "Genero"';
    let consultaEditoriales = 'SELECT "Id", "Nombre" FROM "Editorial"';
    let consultaIdiomas = 'SELECT "Id", "Nombre" FROM "Idioma"';
    
    let respuestaAutores;
    let respuestaGeneros;
    let respuestaEditoriales;
    let respuestaIdiomas;
    try{
        respuestaAutores = await conexion.query(consultaAutores);
        respuestaGeneros = await conexion.query(consultaGeneros);
        respuestaEditoriales = await conexion.query(consultaEditoriales);
        respuestaIdiomas = await conexion.query(consultaIdiomas)
    } catch(err){
        console.log("Error consulta: "+err.message);
    }
    const autores = respuestaAutores.rows;
    const generos=respuestaGeneros.rows;
    const editoriales = respuestaEditoriales.rows;
    const idiomas = respuestaIdiomas.rows;
  
    res.render("ingresoLibros",{autores,generos,editoriales,idiomas})
})

app.post("/agregarLibro",permisosAdmin,async function(req,res){

    //buscar el id para el nuevo libro
    consultaId='SELECT COALESCE(MAX("Id"),0)+1 AS "Id" FROM "Libros"';
    let respuesta;

    try {
      respuesta=await conexion.query(consultaId);
    } catch (error) {
      console.log("error consulta:"+error.message)
      return res.status(500).send("Error al buscar id");
    }

    const id=respuesta.rows[0].Id;
  
    //agregar los datos a la BD
    consultaInsert='INSERT INTO "Libros" VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)'
    const parametros=[id,req.body.nombre,req.body.paginas,req.body.edicion,req.body.autor,
      req.body.editorial,req.body.genero,req.body.idioma,req.body.resumen];

    try {
      await conexion.query(consultaInsert,parametros);
    } catch (error) {
      console.log("error consulta:"+error.message)
      return res.status(500).send("Error al insertar datos");
    }

    //guardar foto si la hay
    if(req.files!=null){
      const ruta=__dirname+"/public/img/"+id+path.extname(req.files.imagen.name);
      req.files.imagen.mv(ruta,function(err){
      if(err){
        console.log("error al guardar archivo:"+error.message)
        return res.status(500).send("Error al guardar archivo");
      }
    })
    }
    res.redirect("ingresoLibros");
  });
  
  app.get("/ingresoautor",permisosAdmin, function(req,res){
  
    res.render("ingresoAutor")
  })

  app.use(bodyparser.urlencoded({ extended: false }));

  app.post("/agregarautor",async function (req,res){

    let consultaId='SELECT COALESCE(MAX("Id"),0)+1 AS "Id" FROM "Autores"';
    let id;
    let autorAgregado = false;

    try{
        id = await conexion.query(consultaId);
    } catch(err){
        console.log("Error al insertar datos: "+err.message);
        return res.status(500).send("Error al insertar datos");
    }

    let insertAutor = 'INSERT INTO "Autores" VALUES($1,$2,$3,$4)';
    const parametros =[id.rows[0].Id,req.body.nombre,req.body.nacimiento,req.body.nacionalidad]

    try{
      autorAgregado= await conexion.query(insertAutor,parametros) || false;

    } catch(err){
      console.log("Error al insertar datos: "+err.message);
      return res.status(500).send("Error al insertar datos");
  }
  var mensaje ='<div class="text-info">Usuario agregado exitosamente</div>'
  req.body={autor:true}
  res.redirect("/ingresoAutor")
  
})

// vista ver mas...
app.get("/libro/:id",async function (req,res) {

  const id = req.params.id;
  let consulta='select l."Id",l."Nombre" AS "Libro",a."Nombre" as "Autor",l."Edicion", '
		consulta+= ' l."Paginas",COALESCE(l."resumen",\'SIN INFORMACIÓN\') AS "Resumen",e."Nombre" as "Editorial",g."Nombre" as "Genero", '
		consulta+= ' i."Nombre" as "Idioma"'
    consulta+= ' FROM "Libros" l '
    consulta+= ' JOIN "Autores" a ON l."IdAutor"=a."Id" '
    consulta+= ' JOIN "Editorial" e ON l."IdEditorial"=e."Id" '
    consulta+= ' JOIN "Genero" g ON l."IdGenero"=g."Id" '
    consulta+= ' JOIN "Idioma" i ON l."IdIdioma"=i."Id"  '
    consulta+= ' WHERE l."Id"=$1 ';

  const parametros=[id];
  let respuesta;
  try{
    respuesta=await conexion.query(consulta,parametros);
  } catch (error){
    console.log("Error: "+error.message)
    return res.status(500).send("Error al consultar datos");

  }
  const libro=respuesta.rows[0];
  const listaArchivos=fs.readdirSync("public/img");
  let archivo=listaArchivos.filter(a=>
    a.split(".")[0]==id
    )
    if(archivo.length==0){
      libro.ruta="../img/noimg.jpg";

    }else{
      libro.ruta="../img/"+archivo[0];
    }
    var rolAdmin=req.headers.cookie || false ;
    res.render("libro",libro)
})

//Admin galeria
app.get("/libros/:id",permisosAdmin,async function (req,res) {

  const id = req.params.id;
  let consulta='select l."Id",l."Nombre" AS "Libro",a."Nombre" as "Autor",l."Edicion", '
		consulta+= ' l."Paginas",COALESCE(l."resumen",\'SIN INFORMACIÓN\') AS "Resumen",e."Nombre" as "Editorial",g."Nombre" as "Genero", '
		consulta+= ' i."Nombre" as "Idioma"'
    consulta+= ' FROM "Libros" l '
    consulta+= ' JOIN "Autores" a ON l."IdAutor"=a."Id" '
    consulta+= ' JOIN "Editorial" e ON l."IdEditorial"=e."Id" '
    consulta+= ' JOIN "Genero" g ON l."IdGenero"=g."Id" '
    consulta+= ' JOIN "Idioma" i ON l."IdIdioma"=i."Id"  '
    consulta+= ' WHERE l."Id"=$1 ';

  const parametros=[id];
  let respuesta;
  try{
    respuesta=await conexion.query(consulta,parametros);
  } catch (error){
    console.log("Error: "+error.message)
    return res.status(500).send("Error al consultar datos");

  }

  let consultaAutores = 'SELECT "Id", "Nombre" FROM "Autores"';
  let consultaGeneros = 'SELECT "Id", "Nombre" FROM "Genero"';
  let consultaEditoriales = 'SELECT "Id", "Nombre" FROM "Editorial"';
  let consultaIdiomas = 'SELECT "Id", "Nombre" FROM "Idioma"';
  
  let respuestaAutores;
  let respuestaGeneros;
  let respuestaEditoriales;
  let respuestaIdiomas;
  try{
      respuestaAutores = await conexion.query(consultaAutores);
      respuestaGeneros = await conexion.query(consultaGeneros);
      respuestaEditoriales = await conexion.query(consultaEditoriales);
      respuestaIdiomas = await conexion.query(consultaIdiomas)
  } catch(err){
      console.log("Error consulta: "+err.message);
  }
  const autores = respuestaAutores.rows;
  const generos=respuestaGeneros.rows;
  const editoriales = respuestaEditoriales.rows;
  const idiomas = respuestaIdiomas.rows;


  const libro=respuesta.rows[0];
  const listaArchivos=fs.readdirSync("public/img");
  let archivo=listaArchivos.filter(a=>
    a.split(".")[0]==id
    )
    if(archivo.length==0){
      libro.ruta="../img/noimg.jpg";

    }else{
      libro.ruta="../img/"+archivo[0];
    }
    res.render("libros",{libro:libro,autores:autores, generos:generos, editoriales:editoriales, idiomas:idiomas})
})



//Eliminar libro
app.get("/eliminar/:id",permisosAdmin,async function (req,res) {

  const id = req.params.id;
  var consulta=`DELETE FROM "Libros" WHERE "Id"=$1`;

  const parametros=[id];
  let respuesta;

  try{
    respuesta=await conexion.query(consulta,parametros);
  } catch (error){
    console.log("Error: "+error.message)
    return res.status(500).send("Error al consultar datos");
  }

  const listaArchivos=fs.readdirSync("public/img");

  //Filtrar img por num de id
  let archivo=listaArchivos.filter(a=>
    a.split(".")[0]==id
    )

    if(archivo.length>=1){
      try {
        fs.unlinkSync('public/img/'+archivo)
        console.log('Eliminado correctamente')
      } catch(err) {
        console.error('Error al remover imagen', err)
      }
    }

    res.redirect("/galeria")
})

// Editar libro
app.get("/update/:id",function(req,res){
 
  res.redirect("/libros/"+id)
 
})

app.post("/update/:id",async function(req,res){
  const id = req.params.id;
  var consulta = 'UPDATE "Libros" SET "Nombre"=$1, "Paginas"=$2, "Edicion"=$3, "IdAutor"=$4, "IdEditorial"=$5, "IdGenero"=$6, "IdIdioma"=$7, "resumen"=$8 WHERE "Id"='+id
  var parametros=[req.body.libro,req.body.Paginas,req.body.Edicion,req.body.autor,req.body.Editorial,req.body.Genero, req.body.idioma, req.body.Resumen];
  var update
  try{
    update=await conexion.query(consulta,parametros);
  } catch (error){
    console.log("Error: "+error.message)
    return res.status(500).send("Error al consultar datos");
  }

  // Revisar si el libro tiene imagen si tiene la borra y añade la imagen si viene
    if(req.files!=null){

      const listaArchivos=fs.readdirSync("public/img");
      let archivo=listaArchivos.filter(a=>
        a.split(".")[0]==id
        )
        if(archivo.length>=1){
          try {
            fs.unlinkSync('public/img/'+archivo)
            console.log('Eliminado correctamente')
          } catch(err) {
            console.error('Error al remover imagen', err)
          }
        }

      const ruta=__dirname+"/public/img/"+id+"."+path.extname(req.files.imagen.name);
      req.files.imagen.mv(ruta,function(err){
      if(err){
        console.log("error al guardar archivo:"+error.message)
        return res.status(500).send("Error al guardar archivo");
      }
    })
    }
  res.redirect("/libros/"+id)
 
  
})

app.post("/enviarcontacto",function(req,res){
  let mensaje = "Mensaje desde formulario de contacto\n";
  mensaje+="de :"+req.body.nombre+"\n";
  mensaje+="correo: "+req.body.correo+"\n";
  mensaje+="mensaje: "+req.body.comentario;
  let mail={
    from: req.body.correo,
    to: process.env.MAILCONTACTO,
    subject:'mensaje formulario contacto',
    text:mensaje
  }
  transporter.sendMail(mail,function(err,info){
    if(err){
      console.log("Error en correo: "+err.message);
      res.status(500).send("Error al enviar correo");
    }else{
      console.log("Correo enviado: "+ info.response);
      res.redirect("/contacto");
    }
  })
})

// Cerrar sesión
app.post("/logout", function (req,res){
  res.cookie(process.env.JWT_COOKIE,"",{httpOnly:true,maxAge:1});
  res.redirect("/login");

})

module.exports={app}