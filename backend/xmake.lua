
set_languages("c++23")


add_requires("boost", {configs = {asio = true, beast = true}})

target("backend")
    set_kind("binary")
    add_files(
        "src/*.cpp",
        "src/**/*.cpp"
    )
    add_includedirs(
        "src",
        "src/app",
        "src/server"
    )
    if is_plat("linux") then
        add_syslinks("dl")
    end
