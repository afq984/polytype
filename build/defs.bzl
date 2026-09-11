"""Polytype's Node actions use the downloaded runtime and declared inputs only."""

load("@rules_rust_wasm_bindgen//:defs.bzl", "RustWasmBindgenInfo")

_NODE = "@rules_nodejs//nodejs:toolchain_type"

def _prebuilt_impl(ctx):
    out = ctx.actions.declare_file(ctx.label.name)
    ctx.actions.symlink(output = out, target_file = ctx.file.src, is_executable = True)
    return [DefaultInfo(executable = out, runfiles = ctx.runfiles(files = [out]))]

prebuilt_binary = rule(
    implementation = _prebuilt_impl,
    executable = True,
    attrs = {"src": attr.label(allow_single_file = True, mandatory = True)},
)

def _bundle_impl(ctx):
    node = ctx.toolchains[_NODE].nodeinfo.node
    runtime = ctx.actions.declare_directory(ctx.label.name + ".runtime")
    pages = ctx.actions.declare_directory(ctx.label.name + ".pages")
    standalone = ctx.actions.declare_file("Polytype-Demo.html")
    bindings = ctx.attr.bindings[RustWasmBindgenInfo]
    manifest = ctx.actions.declare_file(ctx.label.name + ".inputs.json")
    wasm_files = bindings.js.to_list() + [bindings.wasm]
    ctx.actions.write(manifest, json.encode({
        "sources": {f.short_path: f.path for f in ctx.files.srcs},
        "bindings": {f.basename: f.path for f in wasm_files},
        "licenses": [f.path for f in ctx.files.notices],
        "native": ctx.executable.native.path,
        "search": ctx.executable.search.path,
        "runtime": runtime.path,
        "pages": pages.path,
        "standalone": standalone.path,
    }))
    ctx.actions.run(
        executable = node,
        arguments = [ctx.file._stage.path, manifest.path],
        inputs = depset(ctx.files.srcs + ctx.files.notices + wasm_files + [manifest, ctx.file._stage, ctx.executable.native, ctx.executable.search]),
        outputs = [runtime, pages, standalone],
        env = {"TZ": "UTC", "LANG": "C.UTF-8"},
        mnemonic = "PolytypeBundle",
    )
    return [
        DefaultInfo(files = depset([runtime]), runfiles = ctx.runfiles(files = [runtime])),
        OutputGroupInfo(pages = depset([pages]), standalone = depset([standalone])),
    ]

polytype_bundle = rule(
    implementation = _bundle_impl,
    toolchains = [_NODE],
    attrs = {
        "srcs": attr.label_list(allow_files = True),
        "bindings": attr.label(mandatory = True, providers = [RustWasmBindgenInfo]),
        "notices": attr.label(allow_files = True),
        "native": attr.label(executable = True, cfg = "target", mandatory = True),
        "search": attr.label(executable = True, cfg = "target", mandatory = True),
        "_stage": attr.label(default = "//build:stage.mjs", allow_single_file = True),
    },
)

def _node_command_impl(ctx):
    node = ctx.toolchains[_NODE].nodeinfo.node
    runtime = ctx.file.runtime
    runner = ctx.file._runner
    out = ctx.actions.declare_file(ctx.label.name + ".sh")
    # Supported hosts are Linux x86_64. Bazel supplies directory runfiles there.
    ctx.actions.write(out, """#!/bin/sh
set -eu
rf="${RUNFILES_DIR:-${TEST_SRCDIR:-$0.runfiles}}"
exec "$rf/%s/%s" "$rf/%s/%s" '%s' "$rf/%s/%s" "$@"
""" % (ctx.workspace_name, node.short_path, ctx.workspace_name, runner.short_path, ctx.attr.mode, ctx.workspace_name, runtime.short_path), is_executable = True)
    return [DefaultInfo(executable = out, runfiles = ctx.runfiles(files = [node, runner, runtime]))]

_COMMAND_ATTRS = {
    "runtime": attr.label(allow_single_file = True, mandatory = True),
    "mode": attr.string(mandatory = True),
    "_runner": attr.label(default = "//build:run.mjs", allow_single_file = True),
}

node_command = rule(implementation = _node_command_impl, attrs = _COMMAND_ATTRS, executable = True, toolchains = [_NODE])
node_test = rule(implementation = _node_command_impl, attrs = _COMMAND_ATTRS, test = True, toolchains = [_NODE])

def _evaluation_impl(ctx):
    node = ctx.toolchains[_NODE].nodeinfo.node
    out = ctx.actions.declare_directory(ctx.label.name)
    ctx.actions.run(
        executable = node,
        arguments = [ctx.file._runner.path, "evaluation-build", ctx.file.runtime.path, out.path],
        inputs = [ctx.file._runner, ctx.file.runtime],
        outputs = [out],
        env = {"TZ": "UTC", "LANG": "C.UTF-8"},
        mnemonic = "PolytypeEvaluate",
    )
    return [DefaultInfo(files = depset([out]))]

evaluation = rule(implementation = _evaluation_impl, attrs = {"runtime": _COMMAND_ATTRS["runtime"], "_runner": _COMMAND_ATTRS["_runner"]}, toolchains = [_NODE])
