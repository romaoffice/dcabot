-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Oct 25, 2021 at 01:31 PM
-- Server version: 10.4.21-MariaDB
-- PHP Version: 8.0.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `trading`
--

-- --------------------------------------------------------

--
-- Table structure for table `deals`
--

CREATE TABLE `deals` (
  `id` bigint(20) NOT NULL,
  `s_date` varchar(50) DEFAULT NULL,
  `e_date` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `pair` varchar(50) DEFAULT NULL,
  `based` varchar(50) DEFAULT NULL,
  `avg_entry_price` float DEFAULT NULL,
  `entry_price` float DEFAULT NULL,
  `entry_total` float DEFAULT NULL,
  `avg_exit_price` float DEFAULT NULL,
  `exit_qty` float DEFAULT NULL,
  `exit_total` float DEFAULT NULL,
  `take_profit` varchar(50) DEFAULT NULL,
  `DCA_No` int(11) DEFAULT NULL,
  `fees` float DEFAULT NULL,
  `net_profit_per` float DEFAULT NULL,
  `net_profit_amount` float DEFAULT NULL,
  `deal_status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `errors`
--

CREATE TABLE `errors` (
  `id` bigint(20) NOT NULL,
  `no` int(11) DEFAULT NULL,
  `desc` varchar(255) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `status` varchar(10) DEFAULT NULL,
  `pairs` varchar(10) DEFAULT NULL,
  `based` varchar(10) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` bigint(20) NOT NULL,
  `deal_id` int(11) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `order_id` varchar(50) DEFAULT NULL,
  `pair` varchar(50) DEFAULT NULL,
  `based` varchar(50) DEFAULT NULL,
  `side` varchar(50) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `qty` float DEFAULT NULL,
  `usdt` float DEFAULT NULL,
  `average` float DEFAULT NULL,
  `order_type` varchar(50) DEFAULT NULL,
  `level` varchar(50) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `fee` float DEFAULT NULL,
  `role` varchar(50) DEFAULT NULL,
  `order_status` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- --------------------------------------------------------

--
-- Table structure for table `tokens`
--

CREATE TABLE `tokens` (
  `id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `settings_value` varchar(2048) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `deals`
--
ALTER TABLE `deals`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `errors`
--
ALTER TABLE `errors`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `tokens`
--
ALTER TABLE `tokens`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `deals`
--
ALTER TABLE `deals`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `errors`
--
ALTER TABLE `errors`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=625;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=129;

--
-- AUTO_INCREMENT for table `tokens`
--
ALTER TABLE `tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
