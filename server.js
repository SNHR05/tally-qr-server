import express from "express";
import mysql from "mysql2";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import QRCode from "qrcode";
import cors from "cors";

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(cors());

const port = process.env.PORT || 3000;

// Koneksi ke database
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error("❌ Gagal konek ke database:", err);
  } else {
    console.log("✅ Terkoneksi ke database MySQL");
  }
});

// Endpoint generate QR
app.post("/generate", async (req, res) => {
  const { nama, sekolah, kategori, bukti_transfer } = req.body;
  if (!nama || !kategori) {
    return res.status(400).json({ message: "Data tidak lengkap" });
  }

  const qrToken = crypto.randomUUID();
  const qrData = `https://tally-qr-verify.onrender.com/verify/${qrToken}`;

  try {
    const qrImage = await QRCode.toDataURL(qrData);

    db.query(
      "INSERT INTO peserta (nama, sekolah, kategori, bukti_transfer, qr_token) VALUES (?, ?, ?, ?, ?)",
      [nama, sekolah, kategori, bukti_transfer, qrToken],
      (err) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Gagal simpan ke database" });
        }

        res.json({
          message: "QR berhasil dibuat",
          nama,
          sekolah,
          kategori,
          qr_token: qrToken,
          qr_image: qrImage,
        });
      }
    );
  } catch (error) {
    res.status(500).json({ message: "Terjadi kesalahan saat membuat QR" });
  }
});

// Endpoint verifikasi
app.get("/verify/:token", (req, res) => {
  const token = req.params.token;
  db.query("SELECT * FROM peserta WHERE qr_token = ?", [token], (err, result) => {
    if (err) return res.status(500).send("Error database");
    if (result.length === 0) return res.status(404).send("QR tidak valid!");

    const data = result[0];
    res.send(`
      <h2>Bukti Pengambilan Nasi Kuning 🍱</h2>
      <p><strong>Nama:</strong> ${data.nama}</p>
      <p><strong>Sekolah:</strong> ${data.sekolah}</p>
      <p><strong>Kategori:</strong> ${data.kategori}</p>
      <p><strong>Bukti Transfer:</strong> ${data.bukti_transfer}</p>
      <p><em>Terverifikasi ✅</em></p>
    `);
  });
});

// Endpoint webhook dari Tally
app.post("/tally-webhook", async (req, res) => {
  const body = req.body.data || req.body;

  const nama = body.nama || "Tanpa Nama";
  const sekolah = body.sekolah || "-";
  const kategori = body.kategori || "-";
  const bukti_transfer = body.bukti_transfer || "-";

  const qrToken = crypto.randomUUID();
  const qrData = `https://tally-qr-verify.onrender.com/verify/${qrToken}`;
  const qrImage = await QRCode.toDataURL(qrData);

  db.query(
    "INSERT INTO peserta (nama, sekolah, kategori, bukti_transfer, qr_token) VALUES (?, ?, ?, ?, ?)",
    [nama, sekolah, kategori, bukti_transfer, qrToken],
    (err) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ message: "Gagal simpan data webhook" });
      }

      res.json({
        message: "Webhook Tally diterima",
        nama,
        kategori,
        qr_image: qrImage,
        verify_link: qrData,
      });
    }
  );
});

app.listen(port, () => {
  console.log(`✅ Server berjalan di port ${port}`);
});
