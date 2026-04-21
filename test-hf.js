const { HfInference } = require('@huggingface/inference');

const HF_TOKEN = process.env.HUGGINGFACE_API_KEY || 'hf_invalid'; 
const hf = new HfInference(HF_TOKEN);

console.log("Starting...");
hf.textToImage({
  model: 'black-forest-labs/FLUX.1-schnell',
  inputs: 'A cool landscape',
  parameters: { num_inference_steps: 4 }
}).then((res) => {
  console.log("Success:", res.type);
}).catch((err) => {
  console.error("Error occurred:", err.message, err.status, typeof err);
});
