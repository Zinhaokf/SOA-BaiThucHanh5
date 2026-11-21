CREATE DATABASE IF NOT EXISTS soa_th5 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE soa_th5;

CREATE TABLE orders_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL UNIQUE,
  total_revenue DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  total_profit DECIMAL(10,2) NOT NULL
);

CREATE TABLE product_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_report_id INT NOT NULL,
  product_id INT NOT NULL,
  total_sold INT NOT NULL,
  revenue DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  profit DECIMAL(10,2) NOT NULL,
  UNIQUE (order_report_id, product_id),
  FOREIGN KEY (order_report_id) REFERENCES orders_reports(id) ON DELETE CASCADE
);