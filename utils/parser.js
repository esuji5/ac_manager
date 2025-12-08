/**
 * Parser Utility
 * Parses HTML content from Adventar
 */

export const parser = {
  parseAdventar(html) {
    let title = 'Unknown Calendar';
    let articles = [];

    // Title Regex: <title...>Title - Adventar</title>
    const titleMatch = html.match(/<title[^>]*>(.*?) - Adventar<\/title>/);
    if (titleMatch) {
        title = titleMatch[1];
    }

    // Article Regex (Simpler approach than full DOM parsing)
    // Looking for structure: <div class="Entry"> ... <div class="date">DATE</div> ... <div class="article"> ... <a href="URL">TITLE</a>
    
    // While regex parsing HTML is fragile, for this specific task and environment (Service Worker), it's the viable lightweight option.
    // Creating an Offscreen Document is the robust way but adds complexity.
    // Let's try Regex first given the verification output structure is known.

    // Robust Entry Regex:
    // Matches the list items. Since HTML is minified or has newlines, use [\s\S]*?
    
    // Strategy: Split by "class=\"item\"" or similar boundaries if possible.
    // Adventar lists are in <ul class="EntryList">
    
    // Fix: Match <ul> with attributes
    const entryListMatch = html.match(/<ul[^>]*class="EntryList"[^>]*>([\s\S]*?)<\/ul>/);
    if (entryListMatch) {
        const listContent = entryListMatch[1];
        // Split by <li class="item" ...>
        const items = listContent.split(/<li[^>]*class="item"[^>]*>/);
        
        items.forEach(item => {
            if (!item.trim()) return;
            
            // Extract Date (class="date")
            const dateMatch = item.match(/class="date"[^>]*>([^<]+)</);
            
            // Extract User Info
            // <div class="user"><img src="..."> <a ...>NAME</a></div>
            const userIconMatch = item.match(/class="user"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/);
            const userMatch = item.match(/class="user"[^>]*>[\s\S]*?<a[^>]*>([^<]+)</);
            
            // Extract URL and Title
            // <div class="link"><a href="URL" ...>URL</a></div>
            const linkMatch = item.match(/class="link"[^>]*><a[^>]*href="([^"]+)"/);
            
            let articleTitle = '';
            
            // Article title is often in the div sibling to .link inside .left
            // <div class="left"> <div class="link">...</div> <div>TITLE</div> </div>
            // HTML structure varies. 
            // Let's look for text content in .left that is NOT the link URL.
            
            // Relaxed Match: Find class="left" and capture until class="image" OR just use non-greedy to closing div if structure permits
            const leftMatch = item.match(/class="left"[^>]*>([\s\S]*?)<\/div>\s*<div class="image"/);
            
            if (leftMatch) {
                let leftContent = leftMatch[1];
                // Remove the link div
                leftContent = leftContent.replace(/<div[^>]*class="link"[\s\S]*?<\/div>/, '');
                // Remove HTML tags (including the title div wrapper)
                const rawText = leftContent.replace(/<[^>]+>/g, '').trim();
                
                // If we have text and it differs from the URL, use it
                if (rawText.length > 0) {
                     articleTitle = rawText;
                }
            } else {
                 // Try to just find the text after the link closing div tag?
                 const complexMatch = item.match(/class="link"[\s\S]*?<\/div>\s*<div[^>]*>([\s\S]*?)<\/div>/);
                 if (complexMatch) {
                     const possibleTitle = complexMatch[1].replace(/<[^>]+>/g, '').trim();
                     if (possibleTitle) articleTitle = possibleTitle;
                 }
            }
            
            // Fallback: if no title found, use URL
            if (!articleTitle && linkMatch) {
                articleTitle = linkMatch[1];
            }

            if (dateMatch && linkMatch) {
                 articles.push({
                     date: dateMatch[1].trim(),
                     title: articleTitle,
                     url: linkMatch[1],
                     author: userMatch ? userMatch[1].trim() : 'Unknown',
                     icon: userIconMatch ? userIconMatch[1] : null
                 });
            }
        });
    }

    return { title, articles };
  }
};
