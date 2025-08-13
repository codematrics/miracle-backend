# Hospital Management System - Backend

Express.js backend API for the Hospital Management System.

## Deployment to Vercel

### Prerequisites
1. Vercel CLI installed: `npm i -g vercel`
2. MongoDB Atlas database (or any MongoDB cloud instance)
3. Vercel account

### Environment Variables
Set these in Vercel dashboard or via CLI:
- `MONGODB_URI`: Your MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens
- `PORT`: 5000 (optional, Vercel sets this automatically)
- `NODE_ENV`: production

### Deploy Steps

1. Login to Vercel:
```bash
vercel login
```

2. Deploy to Vercel:
```bash
vercel
```

3. For production deployment:
```bash
vercel --prod
```

### Important Notes
- Make sure your MongoDB Atlas cluster allows connections from all IPs (0.0.0.0/0) or add Vercel's IP ranges
- The `vercel.json` file is already configured for Express.js deployment
- All routes are handled by `index.js` as configured in vercel.json

## Local Development

```bash
npm install
npm run dev
```

Create a `.env` file based on `.env.example` for local development.