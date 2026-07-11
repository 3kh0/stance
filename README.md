<h1 align="center">
  <img src="./public/icon.png" alt="Stance" width="96" />
  <br />Stance
</h1>
<h3 align="center">An elegant trading terminal for Polymarket prediction markets.</h3>

## About

Stance is an open-source trading terminal for [Polymarket](https://polymarket.com/) that lets you explore prediction markets and trade them through one clean interface. Built to be lightning fast while still providing all the features you would find on Polymarket. Stance includes live sports data by [Sportradar](https://sportradar.com/), esports data by [GRID](https://grid.gg/live-esports-data/), equity prices by [Pyth](https://www.pyth.network/), and crypto prices by [Chainlink](https://data.chain.link/). Stance also provides fast updates on market prices and order books through [websockets](https://docs.polymarket.com/market-data/websocket/market-channel) to [Polymarket's CLOB](https://docs.polymarket.com/api-reference/markets/get-clob-market-info#get-clob-market-info) with milisecond latency.

Stance also features a **paper trading mode** that lets you simulate trades with real Polymarket data, so you can practice your trading skills without risking any money.

You can use Stance in your browser at [stance.lol](https://stance.lol/) or run it locally on your machine.

## Screenshots

![Homepage](https://gist.github.com/user-attachments/assets/30b4a0bc-1c5c-41f1-a9fa-573150c84527)

Homepage

![Elections](https://gist.github.com/user-attachments/assets/91e97d46-c96c-42a8-84a4-d0cc68aae039)

Elections

![Crypto markets](https://gist.github.com/user-attachments/assets/7c9d8f0d-39a7-4d4a-84c3-1d8582253f35)

Crypto markets

![Bitcoin 5 minute market](https://gist.github.com/user-attachments/assets/4be28937-4332-4cd8-ad7c-0aae33508700)

Bitcoin 5 minute market

![Counter Strike 2 page](https://gist.github.com/user-attachments/assets/98c81496-965b-4864-9128-34ba83d4830d)

Counter Strike 2 page

![Live sports page](https://gist.github.com/user-attachments/assets/bc839ac9-4037-4061-afb2-277535b6177b)

Live sports page

## Local Setup

You will need:

- [Bun](https://bun.sh/)
- A browser made within the past decade

1. Clone the repository:

```bash
git clone https://github.com/3kh0/stance.git
cd stance
bun install
bun run dev
```

2. Open your browser and go to `http://localhost:3000`

## Configuration

Stance is stateless, there is no database and no auth. Server routes simply proxy Polymarket upstreams, your keys stay on your machine. Stance does not have any control over your funds, and you can use it with any wallet that supports [Polygon](https://polygon.technology/).

For production, set `NUXT_PUBLIC_SITE_URL` to your origin so OG and Twitter share URLs work correctly.

## Deployment

Stance is built with Nuxt, so it runs literally anywhere. Build with `bun run build` and deploy the output where you please.

## License

This project is licensed under the GNU GPLv3 License. See the [LICENSE.txt](./LICENSE.txt) file for details. If you are to use this code in your own project, I ask that you do the right thing and open-source your work as well or at least give credit where credit is due.

## Thanks

- Powered by [Nuxt](https://nuxt.com) and [Bun](https://bun.com/)
- Market data from [Polymarket](https://docs.polymarket.com/api-reference/introduction)
- Live sports data from [Sportradar](https://sportradar.com/), esports data from [GRID](https://grid.gg/live-esports-data/), crypto and equity prices from [Pyth](https://www.pyth.network/) and [Chainlink](https://data.chain.link/)

Please note that Stance is not affiliated with, sponsored by, or endorsed by Polymarket.
