#!/bin/bash

  # 检查是否提供了资源名参数
  if [ $# -eq 0 ]; then
      echo "错误: 请提供资源包名作为参数"
      echo "使用方法: $0 <资源包名>"
      echo "示例: $0 kenney_pixel-shmup"
      exit 1
  fi

  # 获取资源包名参数
  RESOURCE_NAME=$1

  # 获取脚本所在目录（即 src/assets/ 目录）
  SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

  # 配置基础URL
  BASE_URL="https://miaoda-app-rs.bj.bcebos.com/game_assets"

  # 构建完整的下载URL
  DOWNLOAD_URL="${BASE_URL}/${RESOURCE_NAME}.zip"

  # 设置输出文件名（使用绝对路径）
  FILENAME="${SCRIPT_DIR}/${RESOURCE_NAME}.zip"

  echo "开始下载资源: ${FILENAME}"
  echo "资源包名: ${RESOURCE_NAME}"
  echo "下载URL: ${DOWNLOAD_URL}"

  # 切换到脚本所在目录
  cd "${SCRIPT_DIR}"

  # 使用wget下载
  wget -O "${FILENAME}" "${DOWNLOAD_URL}"

  # 检查下载是否成功
  if [ $? -ne 0 ]; then
      echo "错误: 下载失败"
      exit 1
  fi

  echo "下载完成: ${FILENAME}"

  # 解压缩文件到当前目录（src/assets/）
  echo "开始解压缩..."
  unzip -q "${FILENAME}"

  # 检查解压是否成功
  if [ $? -ne 0 ]; then
      echo "错误: 解压失败"
      exit 1
  fi

  echo "解压完成"

  # 删除压缩包
  echo "删除压缩包: ${FILENAME}"
  rm "${FILENAME}"

  echo "所有操作完成!"