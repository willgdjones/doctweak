function onInstall(e) {
  onOpen(e);
}

function onOpen(e) {
  try {
    // For regular editor UI
    DocumentApp.getUi()
      .createMenu('AI Assistant')
      .addItem('Show Sidebar', 'showSidebar')
      .addToUi();
  } catch (error) {
    // For add-on card
    return createHomepageCard();
  }
}

function createHomepageCard() {
  const card = CardService.newCardBuilder();
  const section = CardService.newCardSection();
  
  const button = CardService.newTextButton()
    .setText('Show Sidebar')
    .setOnClickAction(CardService.newAction().setFunctionName('showSidebar'));
  
  section.addWidget(button);
  card.addSection(section);
  
  return card.build();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('AI Assistant');
  DocumentApp.getUi().showSidebar(html);
}

function getSelectedText() {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  
  if (!selection) {
    return null;
  }
  
  const elements = selection.getRangeElements();
  let selectedText = '';
  
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    const text = element.getElement().asText();
    
    if (element.isPartial()) {
      selectedText += text.getText().substring(
        element.getStartOffset(),
        element.getEndOffsetInclusive() + 1
      );
    } else {
      selectedText += text.getText();
    }
  }
  
  return selectedText;
}

// Add this utility function for calculating diffs
function findTextDifferences(oldText, newText) {
  const changes = [];
  let i = 0;
  let j = 0;
  
  // Find the first difference
  while (i < oldText.length && j < newText.length && oldText[i] === newText[j]) {
    i++;
    j++;
  }
  
  // If there's a difference, track where it starts
  if (i < oldText.length || j < newText.length) {
    let startIndex = i;
    
    // Find where the difference ends
    let oldIndex = oldText.length - 1;
    let newIndex = newText.length - 1;
    
    while (oldIndex > i && newIndex > j && oldText[oldIndex] === newText[newIndex]) {
      oldIndex--;
      newIndex--;
    }
    
    changes.push({
      startIndex: startIndex,
      oldEndIndex: oldIndex,
      oldText: oldText.substring(startIndex, oldIndex + 1),
      newText: newText.substring(j, newIndex + 1)
    });
  }
  
  return changes;
}

function suggestEdit(originalText, suggestedText) {
  Logger.log('suggestEdit called with:');
  Logger.log('Original text: ' + originalText);
  Logger.log('Suggested text: ' + suggestedText);
  
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  
  if (!selection) {
    throw new Error('No text selected');
  }
  
  try {
    const elements = selection.getRangeElements();
    const element = elements[0];
    const text = element.getElement().editAsText();
    const endOffset = element.getEndOffsetInclusive();
    
    // Insert a newline and the suggested text after the selection
    text.insertText(endOffset + 1, '\n' + suggestedText);
    
    // Color the suggested text in blue
    text.setForegroundColor(endOffset + 2, endOffset + suggestedText.length + 2, '#1155cc');
    
    Logger.log('Changes applied successfully');
    
  } catch (error) {
    Logger.log('Error in suggestEdit: ' + error.toString());
    throw new Error('Failed to apply suggestion: ' + error.message);
  }
}

function getOpenAIResponse(prompt) {
  Logger.log('Starting getOpenAIResponse');
  
  const OPENAI_API_KEY = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not found. Please make sure it is set in Script Properties.');
  }

  const requestOptions = {
    'method': 'post',
    'headers': {
      'Authorization': 'Bearer ' + OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    'muteHttpExceptions': true,
    'timeout': 30000,  // 30 second timeout
    'payload': JSON.stringify({
      'model': 'gpt-3.5-turbo',  // Using a faster model
      'messages': [
        {
          'role': 'user',
          'content': prompt
        }
      ],
      'temperature': 0.7,
      'max_tokens': 1000
    })
  };

  try {
    const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', requestOptions);
    const json = JSON.parse(response.getContentText());
    
    if (json.error) {
      Logger.log('OpenAI Error: ' + JSON.stringify(json.error));
      throw new Error(json.error.message);
    }
    
    return json.choices[0].message.content.trim();
  } catch (error) {
    Logger.log('Error in getOpenAIResponse: ' + error.toString());
    throw new Error('OpenAI API Error: ' + error.message);
  }
}

function processWithAI(selectedText, userMessage) {
  const prompt = `Please improve the following text based on this instruction: ${userMessage}

Text to improve: "${selectedText}"

Important: Provide ONLY the improved version of the text, without any explanations or formatting. The response should be a direct replacement for the original text.`;
  
  const improvedText = getOpenAIResponse(prompt);
  return improvedText;
}

function testAPIKey() {
  Logger.log('Testing API Key access...');
  const properties = PropertiesService.getScriptProperties().getProperties();
  Logger.log('All properties:', properties);
  
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  Logger.log('API Key exists:', apiKey !== null);
  Logger.log('API Key starts with:', apiKey ? apiKey.substring(0, 4) : 'null');
}

// Add a test function for the sidebar
function testSidebarCall() {
  try {
    const result = getOpenAIResponse("Say hello!");
    Logger.log('Test result: ' + result);
    return result;
  } catch (error) {
    Logger.log('Test error: ' + error.toString());
    throw error;
  }
} 