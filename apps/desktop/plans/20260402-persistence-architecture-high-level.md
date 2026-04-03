# HostService Durability Architecture

This doc is about one thing:

- making `HostService` the durable owner of long-lived local services

It is not a general document about all persistence in the app.

## Goal

`HostService` should be the process boundary for long-lived local services.

Examples:

- terminal
- local jobs
- indexing/search
- other service-like runtimes that should outlive renderer churn

## Roles

### ElectronMain

`ElectronMain` is the supervisor.

It should own:

- app lifecycle
- windows
- tray
- menus
- service discovery
- health checks
- restart/update orchestration

It should not own the runtime state of long-lived local services.

### HostService

`HostService` is the durable local service host.

It should own:

- the lifecycle of long-lived local services
- their runtime state
- their control APIs
- reconnect/reattach boundaries
- later, any restore/checkpoint logic they need

### Renderer

The renderer is a client.

It should:

- attach to services
- detach from services
- render their state

It should not define service lifetime.

## Core Rule

Renderer, route, tab, and workspace churn should not redefine the lifetime of a
long-lived service.

If a service should survive that churn, it belongs behind `HostService`.

## Lifecycle Boundaries

Keep these separate:

- view lifetime
- model lifetime
- service runtime lifetime
- `HostService` process lifetime

Most bugs come from collapsing them.

## Transport

Transport can still be websocket.

The important rule is:

- streaming and control belong to `HostService`
- service identity must not depend on the current route or mounted tree
- control operations should not depend on an already-open stream

## Next Phase

### 1. Make HostService Durable

`ElectronMain` should discover and supervise a durable `HostService`.

That means:

- stable discovery
- health checks
- restart semantics
- version / protocol handshake

### 2. Move Long-Lived Services Behind HostService

Each long-lived local service should live behind `HostService` with explicit
operations like:

- create
- attach
- detach
- dispose

### 3. Add Warm Reattach

Before cold restore, a live `HostService` should support clean reattach after:

- workspace switch
- tab switch
- renderer restart
- service reconnect

### 4. Add Restore Later

After warm reattach works, add whatever restore/checkpoint behavior each service
needs.
