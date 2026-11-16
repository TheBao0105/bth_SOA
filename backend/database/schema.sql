-- ============================================================
-- 3 CSDL riêng cho 3 service (SOA: mỗi service một database)
-- Không bắt buộc import: khi chạy `npm start`, service tự tạo
-- database + bảng nếu chưa có. File này để nộp bài / tham khảo.
-- ============================================================

-- ---------- TH2: Auth Service ----------
CREATE DATABASE IF NOT EXISTS auth_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE auth_service_db;

CREATE TABLE IF NOT EXISTS users (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  username   VARCHAR(100) NOT NULL UNIQUE,
  email      VARCHAR(255) NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,              -- bcrypt hash
  role       VARCHAR(20)  NOT NULL DEFAULT 'user', -- user | admin
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ---------- TH3: Product Service ----------
CREATE DATABASE IF NOT EXISTS product_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE product_service_db;

CREATE TABLE IF NOT EXISTS products (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255)   NOT NULL,
  description TEXT,
  price       DECIMAL(10, 2) NOT NULL,
  quantity    INT            NOT NULL DEFAULT 0, -- tồn kho
  created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO products (name, description, price, quantity)
SELECT * FROM (
  SELECT 'Laptop Dell XPS 13', 'Laptop 13 inch, Core i7, 16GB RAM', 25000000, 10 UNION ALL
  SELECT 'Chuột Logitech MX Master 3', 'Chuột không dây', 1500000, 50 UNION ALL
  SELECT 'Bàn phím cơ Keychron K2', 'Bàn phím cơ không dây', 2000000, 20
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM products);

-- ---------- TH4: Order Service ----------
CREATE DATABASE IF NOT EXISTS order_service_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE order_service_db;

CREATE TABLE IF NOT EXISTS orders (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  customer_name  VARCHAR(255)   NOT NULL,
  customer_email VARCHAR(255)   NOT NULL,
  total_amount   DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status         VARCHAR(50)    NOT NULL DEFAULT 'pending', -- pending | completed | cancelled
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  order_id     INT            NOT NULL,
  product_id   INT            NOT NULL, -- liên kết logic với Product Service (khác DB nên không FK)
  product_name VARCHAR(255)   NOT NULL,
  quantity     INT            NOT NULL,
  unit_price   DECIMAL(10, 2) NOT NULL, -- giá tại thời điểm đặt
  total_price  DECIMAL(10, 2) NOT NULL, -- quantity * unit_price
  created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
