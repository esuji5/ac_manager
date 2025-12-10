import { jest } from '@jest/globals';
import { parser } from '../utils/parser.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Adventar Parser', () => {
    let adventarHtml;

    beforeAll(() => {
        try {
            adventarHtml = fs.readFileSync(path.join(__dirname, 'adventar.html'), 'utf8');
        } catch (e) {
            console.warn('Test fixture adventar.html not found, using mock data');
            adventarHtml = `
                <title>Test Calendar - Adventar</title>
                <ul class="EntryList">
                    <li class="item">
                        <div class="date">12/01</div>
                        <div class="user"><img src="icon.png"> <a>User1</a></div>
                        <div class="left"> <div class="link"><a href="http://example.com/1">Link1</a></div> <div>Article Title 1</div> </div>
                    </li>
                </ul>
            `;
        }
    });

    test('should extract calendar title', () => {
        const { title } = parser.parseAdventar(adventarHtml);
        // Expect real title from fixture or mock
        // Fixture title: "専門外の趣味を語る Advent Calendar 2025 - Adventar" -> Extracted: "専門外の趣味を語る Advent Calendar 2025"
        expect(title).not.toBe('Unknown Calendar');
        expect(title.length).toBeGreaterThan(0); 
    });

    test('should extract articles', () => {
        const { articles } = parser.parseAdventar(adventarHtml);
        expect(articles.length).toBeGreaterThan(0);
        
        const firstArticle = articles[0];
        expect(firstArticle).toHaveProperty('date');
        expect(firstArticle).toHaveProperty('title');
        expect(firstArticle).toHaveProperty('url');
        expect(firstArticle).toHaveProperty('author');
    });

    test('should handle empty HTML gracefully', () => {
        const { title, articles } = parser.parseAdventar('');
        expect(title).toBe('Unknown Calendar');
        expect(articles).toEqual([]);
    });
});
