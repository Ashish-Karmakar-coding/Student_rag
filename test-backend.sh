#!/bin/bash
# Test if the backend is accessible on Vercel

echo "Testing backend endpoints..."
echo ""

echo "1. Testing root API route:"
curl -s https://student-rag-frontend.vercel.app/api/ | jq . || echo "No JSON response"
echo ""

echo "2. Testing NextAuth providers:"
curl -s https://student-rag-frontend.vercel.app/api/auth/providers | jq . || echo "Error accessing providers"
echo ""

echo "3. Testing health endpoint:"
curl -s https://student-rag-frontend.vercel.app/api/health | jq . || echo "Health endpoint not accessible"
