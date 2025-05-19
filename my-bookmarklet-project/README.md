# My Bookmarklet Project

This project is a JavaScript bookmarklet that scans the current webpage for events, interacts with an external LLM (likely Gemini Flash) to process the event data, and generates an ICS link for users to add selected events to their calendar.

## Project Structure

```
my-bookmarklet-project
├── src
│   ├── marklet.js        # Main logic for the bookmarklet
│   └── types
│       └── index.js      # Type definitions and interfaces
├── package.json          # NPM configuration file
└── README.md             # Project documentation
```

## Setup Instructions

1. Clone the repository:
   ```
   git clone <repository-url>
   cd my-bookmarklet-project
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage Guidelines

- To use the bookmarklet, simply drag the link provided in the `marklet.js` file to your bookmarks bar.
- Click the bookmarklet while on a webpage to scan for events.
- Follow the prompts to select events and generate an ICS link.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.