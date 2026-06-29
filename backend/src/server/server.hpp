#pragma once

#include <boost/asio/io_context.hpp>
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast.hpp>
#include <memory>

#include "app.hpp"


namespace beast = boost::beast;
namespace asio = boost::asio;





class Server : public std::enable_shared_from_this<Server> {
public:
  Server(asio::io_context& io_ctx, unsigned short port);
  ~Server() = default;
  auto start() -> void;
  auto stop() -> void;


private:
  asio::io_context& io_ctx_;
  unsigned short port_;
  asio::ip::tcp::acceptor acceptor_;
  asio::ip::tcp::socket socket_;



};
