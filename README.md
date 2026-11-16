# Thực hành SOA – TH2 (Auth), TH3 (Product), TH4 (Order)

Một project duy nhất (1 `package.json`, 1 `.env`, 1 lệnh chạy), chia làm **`backend/`** (3 service) và **`frontend/`** (giao diện web).
Mỗi service vẫn **độc lập** theo SOA: **cổng riêng**, **CSDL riêng**, và gọi nhau **qua HTTP**.

| Bài | Service | Cổng | CSDL |
|---|---|---|---|
| TH2 | Auth: đăng ký, đăng nhập JWT, xác thực token | 5000 | `auth_service_db` |
| TH3 | Product: quản lý sản phẩm, tồn kho | 5001 | `product_service_db` |
| TH4 | Order: đơn hàng, chi tiết đơn hàng | 5002 | `order_service_db` |
| – | **Giao diện web** (client gọi 3 service) | **3000** | – |

```
Web :3000 ──▶ Order :5002 ──GET/PUT /products/:id──▶ Product :5001
              │                                      │
              └────────── GET /auth/verify ──────────┴──▶ Auth :5000
```

## Cấu trúc
```
soa-th2-th3-th4/
├── index.js                     khởi động backend + frontend (tất cả hoặc từng phần)
├── package.json                 dependencies dùng chung
├── .env                         cấu hình cổng, CSDL, JWT (dùng chung)
├── SOA.postman_collection.json  bộ request Postman
│
├── backend/                     ===== 3 SERVICE =====
│   ├── config.js                đọc .env
│   ├── shared/
│   │   ├── database.js          tạo kết nối CSDL riêng cho từng service
│   │   ├── authenticate.js      middleware gọi Auth Service kiểm tra token
│   │   └── startService.js      dựng Express app trên cổng riêng
│   ├── services/
│   │   ├── auth/                TH2: models.js, controller.js, index.js
│   │   ├── product/             TH3: models.js, controller.js, index.js
│   │   └── order/               TH4: models.js, orderController.js, orderItemController.js,
│   │                                 productClient.js, helpers.js, index.js
│   ├── database/schema.sql      script tạo 3 CSDL + bảng (để nộp/tham khảo)
│   └── test/api-test.js         test toàn bộ API
│
└── frontend/                    ===== GIAO DIỆN WEB =====
    ├── server.js                phục vụ public/ ở cổng 3000, cấp địa chỉ các service
    └── public/
        ├── index.html
        ├── styles.css
        └── app.js               gọi API Auth / Product / Order
```

## Chạy
1. Bật **MySQL** trong XAMPP Control Panel.
2. Nếu MySQL có mật khẩu root, sửa `DB_PASSWORD` trong `.env`.
3. Cài đặt và chạy:
```
npm install
npm start
```
Service tự tạo 3 database và các bảng nếu chưa có, đồng thời thêm 3 sản phẩm mẫu.
4. Mở trình duyệt: **http://localhost:3000**, đăng ký tài khoản rồi đăng nhập.

| Lệnh | Tác dụng |
|---|---|
| `npm start` | Chạy backend (3 service) + frontend |
| `npm run start:backend` | Chỉ chạy 3 service backend |
| `npm run start:frontend` | Chỉ chạy giao diện web |
| `npm run start:auth` / `start:product` / `start:order` | Chạy riêng từng service |
| `npm test` | Test toàn bộ API (bật `npm start` ở terminal khác trước) |

> Không có MySQL? Đặt `DB_DIALECT=sqlite` trong `.env`, dữ liệu sẽ lưu trong thư mục `backend/data/`.

## Giao diện web (http://localhost:3000)
- **Đăng nhập / Đăng ký**: gọi Auth Service (TH2). Token lưu trong trình duyệt.
- **Sản phẩm**: xem, tìm kiếm, thêm, sửa, xóa (Product Service – TH3). Tồn kho ≤ 5 được tô đỏ.
- **Tạo đơn hàng**: chọn sản phẩm và số lượng vào giỏ, nhập thông tin khách, rồi đặt hàng (Order Service kiểm tra tồn kho).
- **Đơn hàng**: lọc theo trạng thái. Xem chi tiết để sửa số lượng, thêm hoặc xóa mặt hàng, chuyển sang Hoàn thành hoặc Hủy đơn, hoặc xóa đơn.
- Góc trên bên phải có chấm xanh/đỏ cho biết từng service đang chạy hay không.

## Demo bằng Postman
Import `SOA.postman_collection.json`, chạy **Register** rồi **Login**. Token được tự lưu vào `{{token}}` cho mọi request còn lại.

## API

**TH2 – Auth (5000)**
| Method | URL | Body |
|---|---|---|
| POST | /auth/register | `{username, email, password}` |
| POST | /auth/login | `{username` hoặc `email, password}` → `{token}` |
| GET | /auth/verify | Bearer token → `{valid, user}` (service khác gọi) |
| GET | /auth/me | Bearer token |

**TH3 – Product (5001)** – cần Bearer token
| Method | URL | Body |
|---|---|---|
| GET | /products | `?search=` |
| GET | /products/:id | |
| POST | /products | `{name, description, price, quantity}` |
| PUT | /products/:id | trường cần sửa |
| DELETE | /products/:id | |

**TH4 – Order (5002)** – cần Bearer token
| Method | URL | Body |
|---|---|---|
| GET | /orders | `?status=` `?customer_email=` |
| GET | /orders/:id | |
| POST | /orders | `{customer_name, customer_email, items:[{product_id, quantity}]}` |
| PUT | /orders/:id | `{status}` (pending → completed / cancelled) |
| DELETE | /orders/:id | |
| GET | /order_items | `?order_id=` |
| GET | /order_items/:id | |
| POST | /order_items | `{order_id, product_id, quantity}` |
| PUT | /order_items/:id | `{quantity}` |
| DELETE | /order_items/:id | |

### Nghiệp vụ Order
- Tạo đơn: gọi Product Service kiểm tra tồn kho, lấy tên và giá tại thời điểm đặt, rồi tính `total_price = quantity × unit_price` và `total_amount`.
- Không đủ hàng → 400. Sản phẩm không tồn tại → 404. Service khác không chạy → 503.
- Trạng thái chỉ đi từ `pending` sang `completed` hoặc `cancelled`. Đơn đã chốt hoặc đã hủy thì không sửa được item.
- Trừ kho khi đặt, hoàn kho khi hủy đơn, xóa item, hoặc xóa đơn đang pending (tắt bằng `UPDATE_PRODUCT_STOCK=false`).
