package handlers

import (
	"fmt"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/disintegration/imaging"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type MediaHandler struct {
	uploadsDir string
}

func NewMediaHandler(uploadsDir string) *MediaHandler {
	// Создаем директории для хранения файлов
	dirs := []string{
		filepath.Join(uploadsDir, "images"),
		filepath.Join(uploadsDir, "videos"),
		filepath.Join(uploadsDir, "audio"),
		filepath.Join(uploadsDir, "files"),
		filepath.Join(uploadsDir, "thumbnails"),
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			panic(fmt.Sprintf("Failed to create uploads directory: %v", err))
		}
	}

	return &MediaHandler{
		uploadsDir: uploadsDir,
	}
}

// UploadMedia handles file upload
func (h *MediaHandler) UploadMedia(c *gin.Context) {
	// Get uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Validate file size (50MB max)
	if file.Size > 50*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 50MB)"})
		return
	}

	// Determine media type from mime type
	mimeType := file.Header.Get("Content-Type")
	mediaType := h.getMediaType(mimeType)

	if mediaType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Unsupported file type"})
		return
	}

	// Generate unique filename
	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%s%s", uuid.New().String(), ext)

	// Determine subdirectory based on type
	var subdir string
	switch mediaType {
	case "image":
		subdir = "images"
	case "video":
		subdir = "videos"
	case "voice":
		subdir = "audio"
	default:
		subdir = "files"
	}

	// Full path
	filePath := filepath.Join(h.uploadsDir, subdir, filename)

	// Save file
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Generate thumbnail for images
	var thumbnailURL string
	if mediaType == "image" {
		thumbnailURL, _ = h.generateThumbnail(filePath, filename)
	}

	// Generate URLs
	mediaURL := fmt.Sprintf("/api/v1/media/files/%s/%s", subdir, filename)
	if thumbnailURL != "" {
		thumbnailURL = fmt.Sprintf("/api/v1/media/files/thumbnails/%s", thumbnailURL)
	}

	c.JSON(http.StatusOK, gin.H{
		"media_url":     mediaURL,
		"thumbnail_url": thumbnailURL,
		"file_name":     file.Filename,
		"mime_type":     mimeType,
		"file_size":     file.Size,
		"media_type":    mediaType,
	})
}

// ServeFile serves uploaded files
func (h *MediaHandler) ServeFile(c *gin.Context) {
	subdir := c.Param("subdir")
	filename := c.Param("filename")

	// Validate subdirectory
	allowedDirs := []string{"images", "videos", "audio", "files", "thumbnails"}
	isValid := false
	for _, dir := range allowedDirs {
		if dir == subdir {
			isValid = true
			break
		}
	}

	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid directory"})
		return
	}

	// Construct file path
	filePath := filepath.Join(h.uploadsDir, subdir, filename)

	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Serve file
	c.File(filePath)
}

// DeleteFile deletes a file
func (h *MediaHandler) DeleteFile(c *gin.Context) {
	subdir := c.Param("subdir")
	filename := c.Param("filename")

	// Validate subdirectory
	allowedDirs := []string{"images", "videos", "audio", "files", "thumbnails"}
	isValid := false
	for _, dir := range allowedDirs {
		if dir == subdir {
			isValid = true
			break
		}
	}

	if !isValid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid directory"})
		return
	}

	// Construct file path
	filePath := filepath.Join(h.uploadsDir, subdir, filename)

	// Delete file
	if err := os.Remove(filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file"})
		return
	}

	// Delete thumbnail if it's an image
	if subdir == "images" {
		thumbPath := filepath.Join(h.uploadsDir, "thumbnails", filename)
		os.Remove(thumbPath) // Ignore error if thumbnail doesn't exist
	}

	c.JSON(http.StatusOK, gin.H{"message": "File deleted successfully"})
}

// Helper functions

func (h *MediaHandler) getMediaType(mimeType string) string {
	if strings.HasPrefix(mimeType, "image/") {
		return "image"
	}
	if strings.HasPrefix(mimeType, "video/") {
		return "video"
	}
	if strings.HasPrefix(mimeType, "audio/") {
		return "voice"
	}
	// Allow common document types
	allowedMimes := []string{
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		"application/vnd.ms-excel",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		"application/zip",
		"application/x-rar-compressed",
		"text/plain",
	}
	for _, mime := range allowedMimes {
		if mimeType == mime {
			return "file"
		}
	}
	return ""
}

func (h *MediaHandler) generateThumbnail(imagePath, filename string) (string, error) {
	// Open image
	src, err := imaging.Open(imagePath)
	if err != nil {
		return "", err
	}

	// Create thumbnail (300x300 max, maintaining aspect ratio)
	thumb := imaging.Fit(src, 300, 300, imaging.Lanczos)

	// Save thumbnail
	thumbFilename := filename
	thumbPath := filepath.Join(h.uploadsDir, "thumbnails", thumbFilename)

	if err := imaging.Save(thumb, thumbPath); err != nil {
		return "", err
	}

	return thumbFilename, nil
}

// SaveUploadedFile saves a multipart file to disk
func saveUploadedFile(file *multipart.FileHeader, dst string) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	out, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, src)
	return err
}
