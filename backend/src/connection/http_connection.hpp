#pragma once
#include "app.hpp"
#include <boost/asio/ip/tcp.hpp>
#include <boost/beast.hpp>
#include <boost/beast/core/flat_buffer.hpp>
#include <boost/beast/core/tcp_stream.hpp>
#include <boost/beast/http/dynamic_body_fwd.hpp>
#include <boost/beast/http/message_fwd.hpp>
#include <memory>


namespace beast = boost::beast;
namespace asio = boost::asio;


class HttpConnection {
public:
  HttpConnection(asio::ip::tcp::socket socket, std::shared_ptr<AppContext> app_ctx);

  auto start() -> void;


    




private:


  beast::flat_buffer buffer_{a8192};
  asio::ip::tcp::socket socket_;
  beast::http::request<beast::http::dynamic_body> req_;
  beast::http::response<beast::http::dynamic_body> resp_;
  std::shared_ptr<AppContext> app_ctx_;

};


