from livereload import Server

# Initialize the server
server = Server()

# Watch the current directory for changes
server.watch('.')

# Serve the files from the current directory
server.serve(root='.')



