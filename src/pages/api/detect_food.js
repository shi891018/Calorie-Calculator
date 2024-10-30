export const runtime = 'experimental-edge';
const axios = require('axios');

export const config = {
    api: {
        responseLimit: '100mb',
    },
}

const apiKey = process.env.OPENAI_API_KEY;
const endpoint = process.env.OPENAI_ENDPOINT;

async function getCompletion(messages,response_format) {
  try {
    const response = await axios.post(endpoint, {messages,response_format}, {
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      }
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Error fetching completion:', error);
  }
}

// Function to detect food and calories from a base64 encoded image
async function detectFoodAndCalories(base64Image) {

    // Extract MIME type and pure base64 data from the image string
    const match = base64Image.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error('Invalid image data format.');
    }

    const mimeType = match[1];
    const base64Data = match[2];

    const messages = [
        {
            "role": "system",
            "content": "you're a helpful assistant that talks like a pirate"
        },
        {
            "role": "user",
            "content": [
                {
                    type: "text",
                    text: `
                    Identify the food in this picture.
                    Estimate the calories in Cal. unit. \n
                    Estimate the carbohydrate and sugars in g unit. \n
                    Tell the name of the food only in Chinese.\n\n
                    Please return the content in JSON format.
                    example \n
                    {
                        'items': ['ice', 'apple'],
                        'total_calories': xx,
                        'total_carbohydrate': xx,
                        'total_sugars': xx
                    }
                    `
                    },
                {
                    type: "image_url",
                    image_url: {
                        url: `data:${mimeType};base64,${base64Data}`
                    }
                }
            ]
        }
    ]
    const response_format = {"type": "json_object"}

    try {
        console.log("Sending request to Azure OpenAI")
        const response = await getCompletion(messages,response_format)
        const parsedData = JSON.parse(response);
        console.log("Response from Azure OpenAI", parsedData)
        // Return the extracted items and total_calories from the parsed JSON
        return {
            items: parsedData.items,
            count: parsedData.total_calories,
            carbonhydrate: parsedData.total_carbohydrate,
            sugars: parsedData.total_sugars
        };
    } catch (error) {
        console.error('API call failed:', error);
        throw new Error(`Failed to detect food and calories: ${error.message}`);
    }
}

// Handler for the Cloudflare Worker
export default async function handler(req) {
    if (req.method === 'POST') {
        try {
            const { image } = await req.json(); // Parse the image from the POST request's body
            const { items, count, carbonhydrate, sugars } = await detectFoodAndCalories(image);

            // Create and return a successful response
            return new Response(JSON.stringify({ items, count, carbonhydrate, sugars, success: true }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200
            });
        } catch (error) {
            // Create and return an error response
            return new Response(JSON.stringify({ success: false, message: error.message }), {
                headers: { 'Content-Type': 'application/json' },
                status: 500
            });
        }
    } else {
        // Return a 405 Method Not Allowed response for non-POST requests
        return new Response(`Method ${req.method} Not Allowed`, {
            headers: { 'Allow': 'POST' },
            status: 405
        });
    }
}
