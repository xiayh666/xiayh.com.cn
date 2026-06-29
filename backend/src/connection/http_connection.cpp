#include "http_connection.hpp"
#include "app.hpp"
#include <memory>


HttpConnection::HttpConnection(asio::ip::tcp::socket socket, std::shared_ptr<AppContext> app_ctx) : socket_(std::move(socket)) {

}