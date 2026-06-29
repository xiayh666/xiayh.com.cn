set_project("xiayh.com.cn")

includes("backend")

task("frontend")
    set_menu {
        usage = "xmake frontend",
        description = "Build the React/Vite frontend with pnpm",
    }
    on_run(function ()
        os.exec("pnpm --dir frontend install")
        os.exec("pnpm --dir frontend build")
    end)

task("package")
    set_menu {
        usage = "xmake package",
        description = "Build backend and frontend, then stage deployable files in dist/package",
    }
    on_run(function ()
        os.exec("pnpm --dir backend/fastify install --frozen-lockfile")
        os.exec("pnpm --dir backend/fastify build")
        os.exec("pnpm --dir frontend install")
        os.exec("pnpm --dir frontend build")
        os.mkdir("dist/package/backend")
        os.mkdir("dist/package/frontend")
        os.mkdir("dist/package/deploy")
        os.cp("backend/fastify/dist", "dist/package/backend/")
        os.cp("backend/fastify/package.json", "dist/package/backend/")
        os.cp("backend/fastify/pnpm-lock.yaml", "dist/package/backend/")
        os.cp("frontend/dist/*", "dist/package/frontend/")
        os.cp("deploy/*", "dist/package/deploy/")
        os.cp("deploy/blog.env", "dist/package/blog.env.example")
    end)

task("test")
    set_menu {
        usage = "xmake test",
        description = "Run backend unit tests and frontend Vitest suite",
    }
    on_run(function ()
        os.exec("pnpm --dir backend/fastify typecheck")
        os.exec("pnpm --dir backend/fastify test")
        os.exec("pnpm --dir frontend test")
    end)

task("deploy")
    set_menu {
        usage = "xmake deploy --host=<host>",
        description = "Placeholder for rsync/scp deployment to the CM311 box",
        options = {
            {nil, "host", "kv", nil, "Target SSH host"},
        },
    }
    on_run(function ()
        local host = import("core.base.option").get("host")
        assert(host, "pass --host=<ssh-host>")
        os.exec("xmake package")
        print("Package is ready at dist/package. Copy it to " .. host .. ":/opt/cm311-knowledge")
    end)
