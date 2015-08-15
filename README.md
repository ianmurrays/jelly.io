# IN DEVELOPMENT, NOT COMPLETE

# jelly.io

jelly.io is a wrapper of socket.io that adds private and presence room support. This means you can quickly setup these types of rooms using the same principles present in Pusher's service.

It also adds a REST API just like Pusher to send events.

jelly.io supports multiple "apps". Apps are created using different namespaces, meaning you could theoretically build your own complete Pusher with this.

jelly.io should scale horizontally by creating multiple nodes according to socket.io's recommendations. You need to have a redis server and sticky sessions (meaning this will probably not work well in Heroku).

## Room Naming Convention

Same as Pusher's. Private rooms are prepended with `private-` and presence rooms with `presence-`.

# WIP
