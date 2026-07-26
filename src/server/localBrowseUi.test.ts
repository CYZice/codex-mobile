import { describe, expect, it } from 'vitest'
import { decodeBrowsePath } from './localBrowseUi'

describe('decodeBrowsePath', () => {
  it('removes the browse-route slash before Windows drive paths', () => {
    expect(decodeBrowsePath('/C:/Users/Nulled/video.mp4', 'win32')).toBe('C:/Users/Nulled/video.mp4')
    expect(decodeBrowsePath('/C:\\Users\\Nulled\\video.mp4', 'win32')).toBe('C:\\Users\\Nulled\\video.mp4')
    expect(decodeBrowsePath('/%43%3A/Users/Nulled/file.ps1', 'win32')).toBe('C:/Users/Nulled/file.ps1')
    expect(decodeBrowsePath('%2FC%3A%5CUsers%5CNulled%5Cfile.ps1', 'win32')).toBe('C:\\Users\\Nulled\\file.ps1')
  })

  it('preserves Unix, UNC, and already normalized paths', () => {
    expect(decodeBrowsePath('/home/codex/file.txt', 'linux')).toBe('/home/codex/file.txt')
    expect(decodeBrowsePath('//server/share/file.txt', 'win32')).toBe('//server/share/file.txt')
    expect(decodeBrowsePath('%2F%2Fserver%2Fshare%2Ffile.txt', 'win32')).toBe('//server/share/file.txt')
    expect(decodeBrowsePath('C:/Users/Nulled/file.txt', 'win32')).toBe('C:/Users/Nulled/file.txt')
  })

  it('leaves malformed URL encoding usable for the normal validation path', () => {
    expect(decodeBrowsePath('/tmp/100%/file.txt', 'linux')).toBe('/tmp/100%/file.txt')
  })
})
