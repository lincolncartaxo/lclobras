import mysql from 'mysql2/promise';

async function testConnection() {
  try {
    const password = encodeURIComponent('SENHA83h$6g^PYkL[},P');
    const connection = await mysql.createConnection(`mysql://lclpro05_lclobrasapp:${password}@br612.hostgator.com.br:3306/lclpro05_lclobras`);
    console.log("Connected to MySQL successfully!");
    const [rows, fields] = await connection.execute('SHOW TABLES');
    console.log("Tables:", rows);
    await connection.end();
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

testConnection();
