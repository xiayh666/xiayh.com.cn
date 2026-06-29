#include "server.hpp"
#include "app.hpp"
#include "connection/http_connection.hpp"
#include <boost/asio/io_context.hpp>
#include <boost/beast/core/error.hpp>
#include <exception>
#include <memory>
#include <print>

Server::Server(asio::io_context &io_ctx, unsigned short port, std::shared_ptr<AppContext> app_ctx)
    : io_ctx_(io_ctx), port_(port),
      acceptor_(io_ctx, asio::ip::tcp::endpoint(asio::ip::tcp::v4(), port)),
      socket_(io_ctx),
     {}


auto Server::start() -> void {
  acceptor_.async_accept(socket_, [self = shared_from_this()](beast::error_code ec){
    if (ec) {
      std::println("[Server] error connecting: {}", ec.what());
      self->start();
      return;
    }

    // 无 error_code, 启动正常, 发起 Http 连接
    try {
      std::make_shared<HttpConnection>();
    } catch (std::exception& e) {
    
    }




    // 重新启动监听
    self->start();
  });


  try {
  } catch (std::exception& e) {
    std::println("[Exception] {}", e.what()); 
  }

}


auto Server::stop() -> void{

}
