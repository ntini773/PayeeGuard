flowchart TD
    A["Recipient reports payout issue"] --> B["AI interprets the message"]
    B --> C["Fetch actual PayPal payout status"]
    C --> D{"What is the problem?"}

    D -->|"Cannot claim / unconfirmed email"| E["Guide recipient to claim original payout"]
    E --> F["Recheck PayPal status"]
    F --> G["Close or escalate"]

    D -->|"Wrong / inaccessible destination"| H["Authenticate marketplace user"]
    H --> I["Log in with PayPal"]
    I --> J["Retrieve PayPal account ID"]
    J --> K["Compare against existing payee record"]
    K --> L{"Sufficient match?"}
    L -->|"No"| M["Stop and escalate"]
    L -->|"Yes"| N["Prepare destination-change proposal"]
    N --> O["Operator approval"]
    O --> P{"Approved?"}
    P -->|"No"| M
    P -->|"Yes"| Q["Check original payout status"]
    Q --> R{"UNCLAIMED?"}
    R -->|"No"| M
    R -->|"Yes"| S["Attempt cancellation"]
    S --> T{"RETURNED confirmed?"}
    T -->|"No"| M
    T -->|"Yes"| U["Create replacement using PAYPAL_ID"]
    U --> V["Track PayPal status"]
    V --> W["Close case and record audit"]

    D -->|"Redirect to another person"| M