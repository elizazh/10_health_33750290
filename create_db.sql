-- Create database and tables for PCOS Lifestyle Coach
CREATE DATABASE IF NOT EXISTS health;
USE health;

DROP TABLE IF EXISTS daily_logs;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(150) NOT NULL,
  created_at DATETIME NOT NULL
);

CREATE TABLE daily_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  log_date DATE NOT NULL,
  sleep_hours DECIMAL(3,1),
  movement_minutes INT,
  mood_score TINYINT,
  energy_score TINYINT,
  craving_level TINYINT,
  cycle_day INT,
  notes TEXT,
  CONSTRAINT fk_daily_logs_user FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE CASCADE
);

CREATE TABLE recipes (
  recipe_id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  instructions LONGTEXT,
  difficulty ENUM('easy','medium','hard') DEFAULT 'easy',
  prep_time_minutes INT,
  is_pcos_friendly BOOLEAN DEFAULT TRUE,
  main_tag VARCHAR(100)
);
