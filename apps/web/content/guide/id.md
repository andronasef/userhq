<!-- section: overview -->
## Ringkasan & Struktur

UserHQ membantu tim Anda mengumpulkan dan menindaklanjuti masukan (feedback) dari pelanggan. Berikut struktur ruang kerja Anda:

<cards>
- **1. Workspace (Ruang Kerja)**: Pusat kendali tim Anda. Mengelola anggota tim, penagihan, kunci API, webhook, dan kotak masuk masukan terpadu untuk semua produk Anda.
- **2. Products (Produk)**: Aplikasi atau layanan terpisah yang Anda kembangkan (mis. Aplikasi Web, Aplikasi iOS, API). Setiap produk memiliki papan masukan, roadmap, changelog, kategori, dan branding tersendiri.
- **3. Customer Portals (Portal Pelanggan)**: Portal bermerek yang dikunjungi pengguna untuk mengirimkan ide, memberikan suara pada fitur, memantau roadmap publik, dan membaca pengumuman rilis.
</cards>

<!-- section: roles-permissions -->
## Peran & Izin Tim

Berkolaborasi dengan lancar bersama seluruh tim sambil mempertahankan kendali penuh atas pengaturan ruang kerja:

<cards>
- **Workspace Owner (Pemilik)**: Kendali penuh: mengelola langganan, mengundang admin, membuat kunci API, mengonfigurasi webhook, dan mentransfer kepemilikan.
- **Workspace Admin (Administrator)**: Dapat mengelola produk, memilah masukan, membalas pelanggan secara resmi, mengelola kartu roadmap, dan menerbitkan catatan rilis.
- **Workspace Member (Anggota)**: Dapat melihat kiriman masukan, berpartisipasi dalam diskusi internal tim, dan melacak permintaan pelanggan.
</cards>

<!-- section: requests-inbox -->
## Kotak Masuk Permintaan & Triase

Terletak di `/dashboard/[ws]/requests`, kotak masuk permintaan terpadu mengumpulkan seluruh kiriman pelanggan dari setiap produk ke dalam satu tampilan triase berkinerja tinggi.

<cards>
- **Penyaringan Multi-Dimensi**: Filter instan berdasarkan Produk, Fase Status (Backlog, Sedang Dikerjakan, Selesai), Kategori, Pencarian kata kunci, dan Rentang tanggal.
- **Pembaruan Status Cepat**: Pindahkan item antar tahap (Dalam Peninjauan, Direncanakan, Sedang Dikerjakan, Selesai) dengan satu klik. Pelanggan yang memberikan suara akan diberi tahu secara otomatis.
</cards>

<!-- section: comments-attention -->
## Komentar & Kotak Masuk Butuh Perhatian

Terletak di `/dashboard/[ws]/comments`, kotak masuk ini berfungsi sebagai meja dukungan yang responsif untuk setiap diskusi masukan Anda.

### Tahapan Alur Kerja

<stages>
- **Needs Attention (Butuh Perhatian)**: Setiap komentar pelanggan yang belum menerima tanggapan resmi dari tim. Ditandai dengan warna kuning sawo agar tidak ada pertanyaan yang terlewat.
- **Handled (Ditangani)**: Dihapus secara otomatis dari antrean perhatian segera setelah anggota tim membalas dengan lencana resmi, atau ditandai selesai secara manual.
</stages>

<!-- section: author-location -->
## Kontak Penulis & Wawasan Geografis

Untuk memberi tim Anda konteks yang berharga tentang siapa yang mengirimkan masukan, kartu permintaan dan komentar menampilkan detail penulis:

- **Kontak Langsung Melalui Email**: Klik tombol email di samping nama penulis untuk langsung menghubungi mereka untuk wawancara pengguna atau pertanyaan lanjutan.
- **Konteks Geografis**: Lihat perkiraan lokasi pelanggan (mis. `London, United Kingdom [GB]`) untuk memahami tren penggunaan wilayah.
- **Privasi Terjamin**: Alamat email dan lokasi penulis hanya dapat dilihat oleh anggota tim dan tidak pernah ditampilkan di portal pelanggan publik.

<!-- section: customer-portals -->
## Portal Pelanggan Publik

Setiap produk di ruang kerja Anda dapat memiliki portal publik tersendiri di `/[ws]/[product]`.

<cards>
- **Tombol Fitur Modular**: Aktifkan atau nonaktifkan Papan Masukan, Roadmap, Changelog, atau FAQ secara mandiri per produk sesuai kesiapan Anda.
- **Branding & Warna Khusus**: Sesuaikan portal dengan logo, nama merek, dan warna aksen pilihan Anda agar selaras dengan aplikasi Anda.
- **Dukungan Multi-Bahasa & RTL**: Mendukung 13 bahasa dengan deteksi pengunjung otomatis, pemilih bahasa, dan pembuatan konten terlokalisasi.
- **Mengubah Bahasa Default**: Terjemahan yang ada akan dipromosikan ke bidang utama dan teks sebelumnya disimpan sebagai terjemahan cadangan.
- **Lencana Pengguna**: Berikan apresiasi kepada pelanggan dengan lencana di samping nama mereka pada postingan dan komentar.
</cards>

<!-- section: roadmap-changelog -->
## Perencanaan Roadmap & Catatan Rilis

<cards>
- **Roadmap Interaktif**: Atur pengembangan fitur dalam kolom visual (mis. Dalam Pertimbangan, Direncanakan, Sedang Dikerjakan). Tautkan masukan langsung ke kartu roadmap.
- **Changelog & Pengumuman Rilis**: Publikasikan catatan rilis berkategori (Fitur Baru, Peningkatan, Perbaikan Bug) dan beri tahu pelanggan secara otomatis.
</cards>

<!-- section: faq-system -->
## Basis Pengetahuan FAQ Mandiri

Tambahkan pertanyaan umum yang dikelompokkan ke dalam kategori pada portal produk Anda. Memberikan jawaban langsung mengurangi duplikasi kiriman dan beban tiket dukungan.

<!-- section: themes-push -->
## Tema & Pemberitahuan Web Push

UserHQ menyediakan empat tema: **Sistem**, **Terang**, **Gelap** (navy pekat), dan **Charcoal** (hampir hitam netral). Anggota tim dapat mengaktifkan notifikasi Web Push di `/account`.

<!-- section: api-overview -->
## API Otomasi & Otentikasi

Hubungkan sistem eksternal, pipeline CI/CD, Slack, Discord, Linear, GitHub, atau dasbor internal menggunakan UserHQ REST Automation API.

### Header Otentikasi

```http
Authorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx
```

<cards>
- **Batas Kecepatan (Rate Limits)**: Kuota memadai 120 permintaan/menit per kunci API dengan pembatasan token-bucket otomatis.
- **Izin Berlingkup**: Kunci dapat dibatasi pada produk tertentu dan diberi izin baca/tulis khusus untuk sumber daya tertentu.
</cards>

<!-- section: swagger-explorer -->
## Penjelajah API Interaktif

Uji endpoint, periksa parameter, telaah skema permintaan dan respons, serta hasilkan cuplikan kode instan dalam cURL, TypeScript, dan Python.

[component:swagger-explorer]

<!-- section: webhooks-hmac -->
## Webhook & Verifikasi Tanda Tangan HMAC

UserHQ mengirimkan peristiwa HTTP POST real-time setiap kali permintaan dibuat, status berubah, atau komentar baru masuk. Setiap pengiriman menyertakan tanda tangan aman HMAC-SHA256 pada header `x-userhq-signature`.

### Contoh Verifikasi HMAC di Node.js / Express

```typescript
import crypto from "crypto";

export function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const expectedHeader = `sha256=${expectedSignature}`;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedHeader)
  );
}
```
