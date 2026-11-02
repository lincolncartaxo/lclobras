import mysql from 'mysql2/promise';

async function testConnection() {
  try {
    const connection = await mysql.createConnection('mysql://lclpro05_lclobrasapp:SENHA83h$6g^PYkL[},Pbbr612.hostgator.com.br:3306/lclpro05_lclobras');
    console.log("Connected to MySQL successfully!");
    const [rows, fields] = await connection.execute('SHOW TABLES');
    console.log("Tables:", rows);
    await connection.end();
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

testConnection();
